"""
يشتغل جوه GitHub Actions:
  المرحلة 0: Gemini بيراجع index.html واختبارات Playwright الحالية،
             ويحدّث/يضيف اختبارات لو فيه شاشات أو أزرار جديدة (ملف صغير، آمن).
  المرحلة 1: يشغّل الاختبارات.
  المرحلة 2: لو فشل، Gemini يقترح "تصحيح جزئي" (find/replace دقيق) على index.html
             — مش إعادة كتابة الملف كامل، لأن الملف كبير (200+ كيلوبايت)
             وأي موديل LLM له حد أقصى لحجم الرد، فطلب الملف كامل يخرب الملف
             (حصل فعليًا مرة وعمل truncation خرّب الموقع بالكامل — درس متعلّم).

⚠️ الحدود المتفق عليها مع اليوزر:
  - Gemini يتصرف لوحده في الحالات العادية.
  - لو الحلقة فشلت MAX_FIX_ROUNDS مرة، أو حصل استثناء غير متوقع، أو فشل أي
    تحقق أمان (patch مش فريد، أو التغيير في الحجم غير منطقي)، السكريبت
    بيوقف نفسه فورًا من غير ما يكتب/يرفع أي حاجة — عشان تبقى دي نقطة لازم
    Claude يتدخل فيها يدويًا في الشات، مش تكرار عشوائي.
"""
import json
import os
import re
import subprocess
import time

import requests

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
MAX_FIX_ROUNDS = int(os.environ.get("MAX_FIX_ROUNDS", "3"))
TESTS_FILE = "tests/scenarios.spec.js"
INDEX_FILE = "index.html"
# أقصى فرق حجم مقبول لأي تصحيح جزئي واحد — أي حاجة أكبر من كده تبقى مشبوهة
# (يعني ممكن يكون بيحاول يعيد كتابة الملف كله بدل تصحيح صغير) ونرفضها
MAX_PATCH_SIZE_DELTA = 3000


def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout, r.stderr, r.returncode


def call_gemini(prompt: str, max_tokens: int = 4000) -> str:
    resp = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens},
        },
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def strip_code_fence(text: str) -> str:
    """لو Gemini رجّع markdown code fence بالغلط، شيله"""
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines)
    return t


def git_commit_and_push(paths: list, message: str) -> bool:
    run('git config user.name "masar-auto-qa"')
    run('git config user.email "auto-qa@users.noreply.github.com"')
    run(f'git add {" ".join(paths)}')
    out, err, code = run(f'git commit -m "{message}"')
    if code != 0:
        print("مفيش تغييرات جديدة، أو الكومنت فشل:", err)
        return False
    out, err, code = run("git push")
    if code != 0:
        print("❌ فشل الـ push:", err)
        return False
    print("✅ تم الـ push")
    return True


def maybe_update_tests():
    """مرحلة 0: Gemini يراجع الكود والاختبارات ويحدّثها لو محتاجة (ملف اختبارات صغير — آمن)"""
    with open(INDEX_FILE, encoding="utf-8") as f:
        html = f.read()
    with open(TESTS_FILE, encoding="utf-8") as f:
        current_tests = f.read()

    prompt = f"""أنت مهندس QA خبير في Playwright. عندك:

1) كود index.html الحالي لموقع (جزء منه، أهم أجزاء الفورمز والأزرار):
{html[:10000]}

2) ملف اختبارات Playwright الحالي بالكامل:
{current_tests}

المطلوب: راجع لو فيه أي شاشة أو زرار أو فورم جديد في الكود مش متغطي في
ملف الاختبارات، وأضف اختبار Playwright جديد ليه بنفس أسلوب الاختبارات
الموجودة (نفس شكل الـ selectors: locator بالـ id، getByRole للأزرار).
لو الاختبارات الحالية لسه بتغطي كل حاجة موجودة فعليًا، ارجع الملف
زي ما هو من غير أي تغيير.

مهم جدًا: ارجع ملف tests/scenarios.spec.js كاملاً بعد أي تعديل (أو
نفسه لو مفيش تعديل)، بدون أي شرح أو markdown، كود JavaScript خام بس."""

    try:
        updated = strip_code_fence(call_gemini(prompt, max_tokens=6000))
    except Exception as e:
        print("⚠️ فشل Gemini في مراجعة الاختبارات (مش خطأ قاتل، هنكمل بالاختبارات الحالية):", e)
        return

    if updated.strip() and updated.strip() != current_tests.strip():
        with open(TESTS_FILE, "w", encoding="utf-8") as f:
            f.write(updated)
        out, err, code = run(f"node --check {TESTS_FILE}")
        if code != 0:
            print("⚠️ الاختبار الجديد من Gemini فيه خطأ syntax، هنرجع للنسخة القديمة:", err)
            with open(TESTS_FILE, "w", encoding="utf-8") as f:
                f.write(current_tests)
            return
        git_commit_and_push([TESTS_FILE], "تحديث اختبارات Playwright تلقائيًا بواسطة Gemini")
        print("✅ Gemini حدّث ملف الاختبارات (تغيير حقيقي)")
    else:
        print("ℹ️ الاختبارات الحالية كافية، مفيش تحديث لازم")


def get_html_patch(current_html: str, failure_output: str):
    """
    بيطلب من Gemini تصحيح جزئي دقيق (find/replace) بدل إعادة كتابة الملف كامل.
    index.html كبير (200+ كيلوبايت) وأي رد من موديل LLM له حد أقصى لحجم
    الاستجابة — طلب الملف كامل يضمن قطع/تلف الملف. الحل: نطلب فقط الجزء
    اللي المفروض يتغيّر.
    Returns (old_snippet, new_snippet) أو None لو فشل.
    """
    # بنبعت جزء محدود حوالين المكان الأرجح إنه سبب المشكلة (فورم اللوجين +
    # أول 15000 حرف) بدل الملف كامل — كافي عادة لمشاكل selectors/فورمات
    context = current_html[:15000]

    prompt = f"""أنت مبرمج JavaScript/HTML خبير. اختبار Playwright الآلي التالي فشل.
مخرجات الفشل:
{failure_output[:3000]}

جزء من كود index.html الحالي (مش الملف كامل، الملف كبير جدًا):
{context}

المطلوب: حدد أصغر جزء ممكن من الكود (سطر أو سطرين، النص بالظبط كما هو)
يحتاج تعديل عشان يصلح المشكلة دي، والنص البديل بعد التصحيح.

مهم جدًا: رد بصيغة JSON فقط بدون أي شرح أو markdown، بالشكل ده بالظبط:
{{"old": "النص الأصلي بالظبط من الكود اللي هيتغيّر", "new": "النص الجديد بعد التصحيح"}}

لو مش قادر تحدد المشكلة من الجزء المتاح، رد بـ: {{"old": "", "new": ""}}"""

    try:
        raw = strip_code_fence(call_gemini(prompt, max_tokens=2000))
        data = json.loads(raw)
        old, new = data.get("old", ""), data.get("new", "")
        if not old or not new:
            return None
        return old, new
    except Exception as e:
        print("⚠️ فشل فهم رد Gemini كـ JSON patch:", e)
        return None


def apply_html_patch(current_html: str, old: str, new: str):
    """
    تطبيق التصحيح بأمان — بنفس منطق memory_str_replace: old لازم يظهر
    مرة واحدة بالظبط، وحجم الفرق لازم يكون معقول (تصحيح صغير، مش إعادة
    كتابة). أي فشل في التحقق = رفض التصحيح كامل، من غير أي كتابة.
    """
    count = current_html.count(old)
    if count != 1:
        print(f"⚠️ رفض التصحيح: النص المطلوب استبداله ظهر {count} مرة بدل مرة واحدة بالظبط")
        return None
    if abs(len(new) - len(old)) > MAX_PATCH_SIZE_DELTA:
        print("⚠️ رفض التصحيح: حجم التغيير كبير بشكل غير منطقي لتصحيح جزئي")
        return None
    return current_html.replace(old, new, 1)


def main():
    print("===== مرحلة 0: مراجعة/تحديث الاختبارات =====")
    maybe_update_tests()

    print("\n===== مرحلة 1+2: تشغيل الاختبارات + الإصلاح الآلي =====")
    for attempt in range(1, MAX_FIX_ROUNDS + 1):
        print(f"\n🔄 محاولة رقم {attempt}")
        out, err, code = run("npx playwright test --reporter=list")
        print(out)
        print(err)

        if code == 0:
            print("✅ كل الاختبارات عدّت بنجاح.")
            return

        print("❌ في اختبار فشل، هجهز الخطأ لـ Gemini (تصحيح جزئي آمن فقط)...")
        with open(INDEX_FILE, encoding="utf-8") as f:
            current_html = f.read()
        original_len = len(current_html)

        patch = get_html_patch(current_html, out + "\n" + err)
        if patch is None:
            print("🚨 Gemini مقدرش يقترح تصحيح جزئي آمن — دي حالة صعبة، محتاجة مراجعة يدوية من Claude.")
            raise SystemExit(1)

        old, new = patch
        fixed_html = apply_html_patch(current_html, old, new)
        if fixed_html is None:
            print("🚨 التصحيح المقترح مرفوض (فشل تحقق الأمان) — محتاجة مراجعة يدوية من Claude.")
            raise SystemExit(1)

        # تحقق أخير: الملف بعد التصحيح لازم يفضل بنفس الحجم تقريبًا (حماية إضافية من truncation)
        if len(fixed_html) < original_len * 0.95:
            print("🚨 الملف بعد التصحيح صغر بشكل غير منطقي — رفض ومحتاج مراجعة يدوية من Claude.")
            raise SystemExit(1)

        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            f.write(fixed_html)

        pushed = git_commit_and_push(
            [INDEX_FILE], f"Auto-fix جزئي (محاولة {attempt}) بواسطة Gemini بناءً على فشل Playwright"
        )
        if not pushed:
            print("⚠️ إيقاف — مفيش تغيير حقيقي حصل. (نقطة تحتاج مراجعة Claude)")
            raise SystemExit(1)

        print("⏳ مستني GitHub Pages يعمل rebuild (٣٠ ثانية)...")
        time.sleep(30)

    print(f"\n🚨 استنفذنا {MAX_FIX_ROUNDS} محاولات ولسه في اختبارات فاشلة.")
    print("🚨 دي حالة صعبة — محتاجة مراجعة يدوية من Claude، مش تكرار تلقائي أكتر.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
