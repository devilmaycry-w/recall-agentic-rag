
from app.services.embedding_service import generate_embedding

print("Testing Gemini embedding service...")

sample_text = "Recall is an Agentic RAG Knowledge Assistant."

embedding = generate_embedding(sample_text)

print("Embedding generated successfully!")
print("Dimensions:", len(embedding))
print("First 5 values:", embedding[:5])

assert len(embedding) == 768

print("TEST PASSED")
