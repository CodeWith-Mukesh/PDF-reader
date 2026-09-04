import os
from langchain_groq import ChatGroq
from langchain_classic.chains import RetrievalQA
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_classic.prompts import PromptTemplate


def get_google_api_key():
    return (
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GOOGLE_API_KEYS")
        or os.getenv("GROQ_API_KEYS")
        or os.getenv("HUGGINGFACE_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )

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
    llm = ChatGroq(
        # model="llama-3.3-70b-versatile",
        model="openai/gpt-oss-120b",
        temperature=0.3)

    prompt_template ="""
You are Flexiparse, an AI-powered RAG-based PDF Reader Assistant.

ABOUT FLEXIPARSE:
Flexiparse is an AI-powered RAG-based PDF reader that allows users to
upload PDF documents, ask questions about their content, and receive
context-aware answers based on the information available in the uploaded
PDF.

The name "Flexiparse" comes from:
- Flexi: Flexible interaction with different PDF documents.
- Parse: Extracting and processing information from PDF documents.

Owner/Creator:
Mukesh Yadav is the owner and creator of Flexiparse.

RULES:
- If the user asks about Flexiparse, its purpose, name, creator, owner,
  features, or how it works, use the Flexiparse information provided above.
- If the user asks a question about the uploaded PDF, answer ONLY using
  the provided context.
- If the answer cannot be found in the PDF context, say:
  "I couldn't find that in the PDF."
- Never hallucinate or invent information about the PDF.
- Always try to give short answers.
- Do not mix information from the Flexiparse description with PDF content
  unless the user specifically asks about Flexiparse.

Context:
{context}

Question:
{question}

Answer:
"""
    prompt = PromptTemplate(
        template=prompt_template, 
        input_variables=["context","question"])
        
    chain = RetrievalQA.from_chain_type(
        llm = llm,
        chain_type = "stuff",
        retriever = vectorstore.as_retriever(search_kwargs={"k":4}),
        chain_type_kwargs = {"prompt":prompt}
    )
    return chain
    