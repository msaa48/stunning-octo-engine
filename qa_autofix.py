"""
يشتغل جوه GitHub Actions: يشغّل اختبارات Playwright (مجانية بالكامل، من غير
كوتا)، ولو فشل أي اختبار يبعت رسالة الخطأ لـ Groq عشان يصلح index.html
ويعمل commit/push مباشرة.
"""
import os
import subprocess
import time

import requests

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
MAX_FIX_ROUNDS = int(os.environ.get("MAX_FIX_ROUNDS", "3"))


def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout, r.stderr, r.returncode


def groq_fix(html: str, test_output: str) -> str:
    prompt = f"""أنت مبرمج JavaScript/HTML خبير. اختبار Playwright الآلي التالي فشل.
مخرجات الفشل:
{test_output[:4000]}

الكود الحالي (index.html كامل):
{html[:12000]}

أصلح المشكلة وارجع محتوى index.html كاملاً بعد الإصلاح، بدون أي شرح أو markdown، فقط الكود الخام."""
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


def git_commit_and_push(message: str) -> bool:
    run('git config user.name "masar-auto-qa"')
    run('git config user.email "auto-qa@users.noreply.github.com"')
    run("git add index.html")
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


def main():
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

        try:
            fixed_html = groq_fix(current_html, out + "\n" + err)
        except Exception as e:
            print("❌ فشل استدعاء Groq:", e)
            return

        with open("index.html", "w", encoding="utf-8") as f:
            f.write(fixed_html)

        pushed = git_commit_and_push(f"Auto-fix (محاولة {attempt}) بواسطة Groq بناءً على فشل Playwright")
        if not pushed:
            print("⚠️ إيقاف — مفيش تغيير حقيقي حصل.")
            return

        print("⏳ مستني GitHub Pages يعمل rebuild (٣٠ ثانية)...")
        time.sleep(30)

    print(f"\n⚠️ استنفذنا {MAX_FIX_ROUNDS} محاولات ولسه في اختبارات فاشلة — محتاج مراجعة يدوية.")


if __name__ == "__main__":
    main()
