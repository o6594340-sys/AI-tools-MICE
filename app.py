import json
import os

from anthropic import Anthropic
from dotenv import load_dotenv
from flask import Flask, Response, render_template, request, stream_with_context

import prompts as p

load_dotenv()

app = Flask(__name__)
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2000


def build_user_message(mode, data):
    if mode == "brief":
        lang = data.get("language", "русский")
        return f"Вот бриф клиента:\n\n{data.get('brief_text', '')}\n\nПредпочтительный язык ответа: {lang}"

    if mode == "objection":
        obj_type = data.get("objection_type", "определить автоматически")
        lang = data.get("language", "русский")
        context = data.get("context", "").strip()
        msg = f"Тип возражения: {obj_type}\n\nТекст возражения клиента:\n{data.get('objection_text', '')}"
        if context:
            msg += f"\n\nКонтекст / направление: {context}"
        msg += f"\n\nЯзык ответа: {lang}"
        return msg

    if mode == "supplier":
        goals = data.get("goals", [])
        custom_goal = data.get("custom_goal", "").strip()
        if custom_goal:
            goals = goals + [custom_goal]
        goals_text = ", ".join(goals) if goals else "не указана"
        tone = data.get("tone", "нейтральный деловой")
        return (
            f"Контекст / текст от поставщика:\n{data.get('context', '')}\n\n"
            f"Цель письма: {goals_text}\n\n"
            f"Тон письма: {tone}"
        )

    if mode == "dmc":
        tone = data.get("tone", "сдержанный профессиональный")
        return f"Текст от DMC:\n\n{data.get('dmc_text', '')}\n\nТон вывода: {tone}"

    if mode == "followup":
        proposal = data.get("proposal", "").strip() or "не указано"
        days = data.get("days", "4–7")
        tone = data.get("tone", "деловой")
        lang = data.get("language", "русский")
        return (
            f"Что было предложено: {proposal}\n\n"
            f"Дней без ответа: {days}\n\n"
            f"Тон: {tone}\n\n"
            f"Язык письма: {lang}"
        )

    if mode == "concept":
        brief = data.get("brief", "")
        dmc_program = data.get("dmc_program", "").strip()
        msg = f"Бриф:\n{brief}"
        if dmc_program:
            msg += f"\n\nПрограмма от DMC:\n{dmc_program}"
        else:
            msg += "\n\nПрограмма от DMC: не предоставлена (используй Сценарий А)"
        return msg

    return ""


PROMPT_MAP = {
    "brief": p.BRIEF_PROMPT,
    "objection": p.OBJECTION_PROMPT,
    "supplier": p.SUPPLIER_PROMPT,
    "dmc": p.DMC_PROMPT,
    "followup": p.FOLLOWUP_PROMPT,
    "concept": p.CONCEPT_PROMPT,
}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    mode = data.get("mode")
    system_prompt = PROMPT_MAP.get(mode)

    if not system_prompt:
        return Response(
            f"data: {json.dumps({'error': 'Неизвестный режим'})}\n\n",
            content_type="text/event-stream",
        )

    user_message = build_user_message(mode, data)

    def stream():
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(stream()),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(debug=True)
