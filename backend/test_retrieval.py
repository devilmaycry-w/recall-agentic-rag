
from app.services.retrieval_service import retrieve_relevant_chunks

question = "What programming languages and technical skills are mentioned in the resume?"

print("Question:", question)
print("\nSearching knowledge base...\n")

results = retrieve_relevant_chunks(question, top_k=3)

if not results:
    print("No relevant chunks found.")
else:
    for index, result in enumerate(results, start=1):
        print(f"\n--- Result {index} ---")
        print("File:", result["filename"])
        print("Page:", result["page_number"])
        print("Distance:", round(result["distance"], 4))
        print("Content:")
        print(result["content"])
