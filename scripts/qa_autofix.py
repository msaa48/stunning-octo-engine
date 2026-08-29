"""
يشتغل جوه GitHub Actions مباشرة (مش محتاج توكن GitHub منفصل، لأن
الـ workflow نفسه بيعمل commit/push بصلاحية contents:write بتاعته).

بيشغّل كل ملفات الخطط الموجودة في /tmp/plans/*.json واحدة واحدة،
ولو أي واحدة فشلت بيحاول يصلحها بـ Groq قبل ما ينتقل للي بعدها.
"""
import os
import json
import glob
import subprocess
import time

import requests

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
DEPLOYED_URL = os.environ["DEPLOYED_URL"]
MAX_FIX_ROUNDS = int(os.environ.get("MAX_FIX_ROUNDS", "3"))


def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout.strip(), r.stderr.strip(), r.returncode


def run_test_cycle(plan_path):
    out, err, code = run(
        f"testsprite test create --plan-from {plan_path} "
        "--run --wait --timeout 600 --output json"
    )
    result = json.loads(out) if out else {}
    result["_exit_code"] = code
    result["_stderr"] = err
    return result


def read_failure_bundle(test_id):
    run(f"testsprite test failure get {test_id} --out /tmp/failure")
    bundle = {}
    for fname in ("result.json", "failure.json"):
        fpath = f"/tmp/failure/{fname}"
        if os.path.exists(fpath):
            with open(fpath, encoding="utf-8") as f:
                bundle[fname] = json.load(f)
    return bundle


def groq_fix(html: str, bundle: dict, scenario_name: str) -> str:
    prompt = f"""أنت مبرمج JavaScript/HTML خبير. الكود التالي فشل في اختبار آلي اسمه "{scenario_name}".
تفاصيل الفشل (من TestSprite):
{json.dumps(bundle, ensure_ascii=False)[:4000]}

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
        print("مفيش تغييرات جديدة للـ commit، أو حصل خطأ:", err)
        return False
    out, err, code = run("git push")
    if code != 0:
        print("❌ فشل الـ push:", err)
        return False
    print("✅ تم الـ push")
    return True


def run_scenario(plan_path):
    with open(plan_path, encoding="utf-8") as f:
        plan = json.load(f)
    scenario_name = plan.get("name", plan_path)
    print(f"\n===== سيناريو: {scenario_name} =====")

    for attempt in range(1, MAX_FIX_ROUNDS + 1):
        print(f"🔄 محاولة رقم {attempt}")
        result = run_test_cycle(plan_path)

        if result.get("_exit_code") == 0:
            print("✅ نجح.")
            return True

        test_id = result.get("testId") or result.get("id")
        if not test_id:
            print("⚠️ ما قدرش ياخد testId من النتيجة:", result)
            return False

        print("❌ فشل، هجيب تفاصيل الخطأ...")
        bundle = read_failure_bundle(test_id) or {"raw_error": result.get("_stderr", "")}

        with open("index.html", encoding="utf-8") as f:
            current_html = f.read()

        print("🤖 بابعت الخطأ لـ Groq عشان يقترح إصلاح...")
        try:
            fixed_html = groq_fix(current_html, bundle, scenario_name)
        except Exception as e:
            print("❌ فشل استدعاء Groq:", e)
            return False

        with open("index.html", "w", encoding="utf-8") as f:
            f.write(fixed_html)

        pushed = git_commit_and_push(
            f"Auto-fix ({scenario_name}, محاولة {attempt}) بواسطة Groq"
        )
        if not pushed:
            print("⚠️ إيقاف — مفيش تغيير حقيقي حصل في الكود.")
            return False

        print("⏳ مستني GitHub Pages يعمل rebuild (٣٠ ثانية)...")
        time.sleep(30)

    print(f"⚠️ استنفذنا {MAX_FIX_ROUNDS} محاولات وسيناريو '{scenario_name}' لسه فاشل.")
    return False


def main():
    plan_files = sorted(glob.glob("/tmp/plans/*.json"))
    if not plan_files:
        print("⚠️ مفيش ملفات خطط اختبار في /tmp/plans/")
        return

    results = {}
    for plan_path in plan_files:
        results[plan_path] = run_scenario(plan_path)

    print("\n===== ملخص نهائي =====")
    for path, ok in results.items():
        print(("✅" if ok else "❌"), path)


if __name__ == "__main__":
    main()
