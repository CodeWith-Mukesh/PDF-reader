from dotenv import load_dotenv
load_dotenv()
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import os
import shutil

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
# CHROMA_DIR = f"chroma_db_{EMBEDDING_MODEL.replace('/', '_')}"
CHROMA_PATH = "chroma_db" 

def vectorstore(pdf_path):
    #This will delete all the old files and startb new chat
    try:
        old = Chroma(persist_directory=CHROMA_PATH, embedding_function=HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL))
        old.delete_collection()  # ← collection ke andar ka data delete
        print("Old collection deleted.")
    except:
        pass
    if os.path.exists("chroma_db"):
        shutil.rmtree("chroma_db", ignore_errors=True)
        print("Old ChromaDB cleared.")
    
    loader = PyPDFLoader(pdf_path)
    document = loader.load()

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(document)
    chunks = [chunk for chunk in chunks if chunk.page_content.strip()]
    if not chunks:
        raise ValueError(
            "No text was extracted from the PDF. Please upload a PDF with selectable text."
        )
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    if os.path.exists("chroma_db"):
        shutil.rmtree("chroma_db", ignore_errors=True)
    vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory=CHROMA_PATH)
    return vectorstore


def load_vector():
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vectorstore = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
    return vectorstore  

