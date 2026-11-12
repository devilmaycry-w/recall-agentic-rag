import time
from app.services.router_service import route_question
from app.services.qa_service import ask_question
from app.services.llm_service import generate_answer
from app.services.sql_service import execute_safe_query


def process_query(question: str, top_k: int = 5) -> dict:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    t_start = time.perf_counter()
    trace = [
        {
            "name": "User Query Received",
            "status": "done",
            "duration_ms": 0,
            "details": f"top_k={top_k}, length={len(question)} chars",
        }
    ]

    # Step 1: Determine the query intent
    t0 = time.perf_counter()
    routing_result = route_question(question)
    route = routing_result["route"]
    reason = routing_result.get("reason", "")
    trace.append({
        "name": "Intent Classification & Route Selection",
        "status": "done",
        "duration_ms": round((time.perf_counter() - t0) * 1000),
        "details": f"Selected {route} — {reason}",
    })

    # Step 2: Execute the selected route
    t1 = time.perf_counter()
    if route == "DOCUMENT_SEARCH":
        result = ask_question(question, top_k=top_k)
        exec_ms = round((time.perf_counter() - t1) * 1000)
        sc = result.get("self_correction", {})

        trace.append({
            "name": "Vector Retrieval & Grounded Generation",
            "status": "done",
            "duration_ms": exec_ms,
            "details": f"Retrieved {len(result.get('sources', []))} source chunks",
        })
        trace.append({
            "name": "Self-Correction Evaluation",
            "status": "done",
            "duration_ms": 0,
            "details": f"Verdict: {result.get('verification', 'NOT_EVALUATED')} (retry={sc.get('retry_performed', False)})",
        })
        trace.append({
            "name": "Final Response",
            "status": "done",
            "duration_ms": round((time.perf_counter() - t_start) * 1000),
            "details": "Response verified and dispatched",
        })

        return {
            "route": route,
            "reason": reason,
            "trace": trace,
            **result,
        }

    elif route == "SQL_QUERY":
        result = execute_safe_query(question)
        exec_ms = round((time.perf_counter() - t1) * 1000)
        trace.append({
            "name": "Safe SQL Execution",
            "status": "done",
            "duration_ms": exec_ms,
            "details": "Executed read-only SQL query against PostgreSQL",
        })
        trace.append({
            "name": "Final Response",
            "status": "done",
            "duration_ms": round((time.perf_counter() - t_start) * 1000),
            "details": "SQL query result returned",
        })

        return {
            "route": route,
            "reason": reason,
            "verification": "SUPPORTED",
            "trace": trace,
            **result,
            "sources": [],
        }

    elif route == "CLARIFICATION":
        trace.append({
            "name": "Clarification Prompt",
            "status": "done",
            "duration_ms": 0,
            "details": "Requested additional user context",
        })
        return {
            "route": route,
            "reason": reason,
            "answer": "Could you please clarify your question?",
            "verification": "NOT_EVALUATED",
            "trace": trace,
            "sources": [],
        }

    elif route == "GENERAL":
        answer = generate_answer(
            f"""
You are Recall, a helpful knowledge assistant.

Answer this general conversational question concisely.
Do not claim to have searched uploaded documents.

User question:
{question}
"""
        )
        exec_ms = round((time.perf_counter() - t1) * 1000)
        trace.append({
            "name": "General LLM Generation",
            "status": "done",
            "duration_ms": exec_ms,
            "details": "Answered without document retrieval",
        })

        return {
            "route": route,
            "reason": reason,
            "answer": answer,
            "verification": "NOT_EVALUATED",
            "trace": trace,
            "sources": [],
        }

    else:
        return {
            "route": "CLARIFICATION",
            "reason": "Unexpected route value.",
            "answer": "Could you please clarify your question?",
            "verification": "NOT_EVALUATED",
            "trace": trace,
            "sources": [],
        }