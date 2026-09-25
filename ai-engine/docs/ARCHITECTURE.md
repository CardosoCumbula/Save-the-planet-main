# Architecture

How the React frontend, the FastAPI service and the trained models fit
together.

## High-level diagram

```text
React Application (EcoQuest UI)
       |
       v
aiEngineService.ts  (timeout, cached health check, offline fallback)
       |
       v
FastAPI (localhost:8000)
       |
       +---- Mastery Model  (POST /predict/difficulty-for-user)
       |
       +---- Answer Grader  (POST /grade/answer)
       |
       +---- Recommender    (POST /recommend/topics)
       |
       v
.joblib artifacts (load once at startup)
       |
       v
Interaction logs (data/raw/live_interactions.csv)
       |
       v
Future retraining (re-run pipeline)
```

The Gemini layer runs alongside: it generates lessons, topics and conversational
assistance, while Python/scikit-learn provides mastery prediction, free-text
grading and topic recommendation.

## Lesson request flow

```text
User taps a topic on the map
   -> startLesson(topic, index)
        -> [ML] predictDifficultyForUser(history, topic)  (if available)
        -> generateProceduralLesson(topic, difficulty, ...)   (Gemini)
        -> validateLesson(lesson)  -> retry once if invalid
        -> render lesson
```

If Python is offline, `predictDifficultyForUser` is skipped and the original
"level > 5 ? Intermediate : Beginner" rule is used. The lesson still generates
through Gemini.

## Answer grading flow

```text
User checks an answer
   -> checkAnswer()
        -> FILL_BLANK / SPEAKING and AI available?
              yes -> gradeAnswer(userAnswer, expected)  (Python)
              no  -> existing exact/match logic
        -> verdict  CORRECT | ALMOST | WRONG
              ALMOST -> partial credit, no heart lost, hint
        -> logInteraction(...)  (fire-and-forget)
```

## Interaction logging / feedback loop

Every answered exercise is appended to the in-memory session history and, when
the service is up, POSTed to `/log/interaction`. The FastAPI service appends it
to `data/raw/live_interactions.csv`, which the pipeline loads alongside the
synthetic data on the next training run. This is the closed feedback loop that
supports future retraining.

## Python package layout

```text
ai_engine/
  data/      simulate.py  prepare.py  features.py
  models/    mastery.py   grader.py   recommender.py
  evaluation/evaluate.py
  pipeline/  run_all.py  (simulate -> prepare -> train -> evaluate -> report)
  service/   api.py  schemas.py
  tools/     export_code.py
```

## Frontend ↔ service contract

`services/aiEngineService.ts` defines typed wrappers for each endpoint and a
cached `isAiEngineAvailable()` state. Every request has a 2.5 second timeout and
a safe fallback, so the game never blocks or crashes when Python is down.