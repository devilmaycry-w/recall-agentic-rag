
from app.services.llm_service import generate_answer

prompt = """
You are Recall, a document knowledge assistant.

Answer this question in one short sentence:
What is Retrieval-Augmented Generation (RAG)?
"""

print("Testing OpenRouter LLM...")

answer = generate_answer(prompt)

print("\nGenerated answer:")
print(answer)

print("\nTEST PASSED")
