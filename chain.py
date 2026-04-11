import os
from langchain_groq import ChatGroq
from langchain_classic.chains import RetrievalQA
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_classic.prompts import PromptTemplate


def get_google_api_key():
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEYS")


def get_prompt(vectorstore):
    api_key = get_google_api_key()
    if not api_key:
        raise ValueError(
            "Google Gemini API key required. Set GEMINI_API_KEY or GOOGLE_API_KEY in .env or environment."
        )

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.3,
        google_api_key=api_key,
    )
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)

    prompt_template = """
You are a PDF Reader Assistant.

Owner: Mukesh

Rules:
- Always answer from provided context only
- If not found: "I couldn't find that in the PDF."
- Never hallucinate
- If asked about owner or creator : Mukesh is the owner

Context:
{context}

Question:
{question}

Answer:
"""
    prompt = PromptTemplate(template=prompt_template, input_variables=["context","question"])
    chain = RetrievalQA.from_chain_type(
        llm = llm,
        chain_type = "stuff",
        retriever = vectorstore.as_retriever(search_kwargs={"k":4}),
        chain_type_kwargs = {"prompt":prompt}
    )
    return chain
    