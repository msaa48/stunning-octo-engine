"""
يشتغل جوه GitHub Actions:
  المرحلة 0 (جديدة): Groq بيراجع index.html واختبارات Playwright الحالية،
                       ويحدّث/يضيف اختبارات لو فيه شاشات أو أزرار جديدة.
  المرحلة 1: يشغّل الاختبارات.
  المرحلة 2: لو فشل، Groq يصلح index.html، ويعيد المحاولة (لحد 3 مرات).

⚠️ الحدود المتفق عليها مع اليوزر:
  - Groq يتصرف لوحده في الحالات العادية.
  - لو الحلقة فشلت MAX_FIX_ROUNDS مرة، أو حصل استثناء غير متوقع، السكريبت
    بيوقف نفسه فورًا ويطلع فشل واضح — من غير أي محاولات إضافية عشوائية —
    عشان تبقى دي نقطة لازم Claude يتدخل فيها يدويًا في الشات.
"""
import os
import subprocess
import time

import requests

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
MAX_FIX_ROUNDS = int(os.environ.get("MAX_FIX_ROUNDS", "3"))
TESTS_FILE = "tests/scenarios.spec.js"


def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout, r.stderr, r.returncode


def call_groq(prompt: str) -> str:
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        },
        timeout=90,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def strip_code_fence(text: str) -> str:
    """لو Groq رجّع markdown code fence بالغلط، شيله"""
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
    """مرحلة 0: Groq يراجع الكود والاختبارات ويحدّثها لو محتاجة"""
    with open("index.html", encoding="utf-8") as f:
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
        updated = strip_code_fence(call_groq(prompt))
    except Exception as e:
        print("⚠️ فشل Groq في مراجعة الاختبارات (مش خطأ قاتل، هنكمل بالاختبارات الحالية):", e)
        return

    if updated.strip() and updated.strip() != current_tests.strip():
        with open(TESTS_FILE, "w", encoding="utf-8") as f:
            f.write(updated)
        # تأكيد إن الكود اللي رجعه Groq صحيح syntax-wise قبل ما نرفعه
        out, err, code = run(f"node --check {TESTS_FILE}")
        if code != 0:
            print("⚠️ الاختبار الجديد من Groq فيه خطأ syntax، هنرجع للنسخة القديمة:", err)
            with open(TESTS_FILE, "w", encoding="utf-8") as f:
                f.write(current_tests)
            return
        git_commit_and_push([TESTS_FILE], "تحديث اختبارات Playwright تلقائيًا بواسطة Groq")
        print("✅ Groq حدّث ملف الاختبارات (تغيير حقيقي)")
    else:
        print("ℹ️ الاختبارات الحالية كافية، مفيش تحديث لازم")


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

        print("❌ في اختبار فشل، هجهز الخطأ لـ Groq...")
        with open("index.html", encoding="utf-8") as f:
            current_html = f.read()

        prompt = f"""أنت مبرمج JavaScript/HTML خبير. اختبار Playwright الآلي التالي فشل.
مخرجات الفشل:
{(out + chr(10) + err)[:4000]}

الكود الحالي (index.html كامل):
{current_html[:12000]}

أصلح المشكلة وارجع محتوى index.html كاملاً بعد الإصلاح، بدون أي شرح أو markdown، فقط الكود الخام."""

        try:
            fixed_html = strip_code_fence(call_groq(prompt))
        except Exception as e:
            print("❌ فشل استدعاء Groq — هنوقف الحلقة فورًا (نقطة تحتاج مراجعة Claude):", e)
            raise SystemExit(1)

        with open("index.html", "w", encoding="utf-8") as f:
            f.write(fixed_html)

        pushed = git_commit_and_push(
            ["index.html"], f"Auto-fix (محاولة {attempt}) بواسطة Groq بناءً على فشل Playwright"
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
