
from app.services.pdf_service import extract_pdf_text

pdf_path = "uploads/2e9d9521-8c17-4307-81b6-1b52d8f15af4.pdf"

result = extract_pdf_text(pdf_path)

print("Total pages:", result["total_pages"])
print("Extracted pages:", result["extracted_pages"])

for page in result["pages"]:
    print(f"\n--- Page {page['page_number']} ---")
    print(page["text"][:500])
