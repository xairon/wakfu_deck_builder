import requests
import os
from bs4 import BeautifulSoup
import json
from typing import Dict, List
import time
import re

# URLs des cartes exemples pour chaque type
SAMPLE_CARDS = {
    "hero": "https://www.wtcg-return.fr/cartes/incarnam/tirlangue-portey-1",
    "action": "https://www.wtcg-return.fr/cartes/incarnam/sacrifice",
    "ally": "https://www.wtcg-return.fr/cartes/incarnam/arakne",
    "equipment": "https://www.wtcg-return.fr/cartes/amakna/bworky",
    "zone": "https://www.wtcg-return.fr/cartes/amakna/chateau-damakna",
    "familiar": "https://www.wtcg-return.fr/cartes/amakna/bworky",
    "dofus": "https://www.wtcg-return.fr/cartes/incarnam/dofus-emeraude",
    "room": "https://www.wtcg-return.fr/cartes/incarnam/temple-cra"
}

def clean_text(text: str) -> str:
    """Nettoie le texte en enlevant les espaces inutiles et les caractères spéciaux"""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def extract_number(text: str) -> int:
    """Extrait un nombre d'une chaîne de caractères"""
    if not text:
        return 0
    match = re.search(r'\d+', text)
    if match:
        return int(match.group())
    return 0

def extract_name_and_type(text: str) -> tuple[str, str]:
    """Extrait le nom et le type d'une carte à partir du texte du h1"""
    if not text:
        return "", ""
    # Le type est généralement après le nom, séparé par des espaces
    parts = text.strip().split()
    if len(parts) >= 2:
        # Le dernier mot est généralement le type
        return " ".join(parts[:-1]), parts[-1]
    return text, ""

def download_and_analyze_card(card_type: str, url: str) -> Dict:
    """Télécharge et analyse la structure HTML d'une carte"""
    print(f"\nAnalyse de la carte de type {card_type}: {url}")
    
    # Téléchargement de la page avec un User-Agent
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    # Sauvegarde du HTML pour debug
    os.makedirs("debug", exist_ok=True)
    with open(f"debug/{card_type}_card.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    analysis = {
        "url": url,
        "type": None,
        "name": None,
        "class": None,
        "image_url": None,
        "stats": {},
        "effects": [],
        "notes": [],
        "rarity": None,
        "extension": None,
        "extension_number": None,
        "flavor": None,
        "has_back_face": False,
        "elements": [],
        "keywords": []
    }
    
    # Extraction du nom et du type
    h1_elem = soup.find("h1")
    if h1_elem:
        # Le type est dans le small
        type_elem = h1_elem.find("small", class_="text-muted")
        if type_elem:
            analysis["type"] = clean_text(type_elem.text)
            type_elem.decompose()  # Retire le small pour ne garder que le nom
        analysis["name"] = clean_text(h1_elem.text)
    
    # Extraction de la classe
    hstack = soup.find("div", class_="hstack")
    if hstack:
        divs = hstack.find_all("div", recursive=False)
        if len(divs) >= 2:
            analysis["class"] = clean_text(divs[1].text)
    
    # Extraction de l'image
    img = soup.find("img", class_="round-card")
    if img and "src" in img.attrs:
        analysis["image_url"] = img["src"]
    
    # Extraction des stats
    stats_div = soup.find("div", class_="hstack", string=lambda x: x and ("PA" in x or "PM" in x or "PV" in x))
    if stats_div:
        for div in stats_div.find_all("div", recursive=False):
            text = clean_text(div.text)
            if "PA" in text:
                analysis["stats"]["pa"] = extract_number(text)
            elif "PM" in text:
                analysis["stats"]["pm"] = extract_number(text)
            elif "PV" in text:
                analysis["stats"]["pv"] = extract_number(text)
    
    # Extraction des effets
    effects_div = soup.find("div", string=lambda x: x and "Effets" in x)
    if effects_div:
        ul = effects_div.find_next("ul")
        if ul:
            analysis["effects"] = [clean_text(li.text) for li in ul.find_all("li")]
    
    # Extraction des notes
    notes_div = soup.find("div", string=lambda x: x and "Notes" in x)
    if notes_div:
        ul = notes_div.find_next("ul")
        if ul:
            analysis["notes"] = [clean_text(li.text) for li in ul.find_all("li")]
    
    # Extraction de la rareté
    rarity_div = soup.find("div", string=lambda x: x and "Rareté" in x)
    if rarity_div:
        text = clean_text(rarity_div.text)
        match = re.search(r'Rareté\s*:\s*(?:🟄\s*)?([^🟄\n]+)', text)
        if match:
            analysis["rarity"] = clean_text(match.group(1))
    
    # Extraction de l'extension
    extension_div = soup.find("div", string=lambda x: x and "Extension" in x)
    if extension_div:
        text = clean_text(extension_div.text)
        match = re.search(r'Extension\s*:\s*([^\d]+)(?:\s*(\d+)/(\d+))?', text)
        if match:
            analysis["extension"] = clean_text(match.group(1))
            if match.group(2):
                analysis["extension_number"] = int(match.group(2))
    
    # Extraction du texte d'ambiance
    flavor_div = soup.find("div", string=lambda x: x and "—" in x)
    if flavor_div:
        analysis["flavor"] = clean_text(flavor_div.text)
    
    # Vérification de la face arrière
    back_link = soup.find("a", string=lambda x: x and "autre face" in x)
    analysis["has_back_face"] = bool(back_link)
    
    # Extraction des éléments
    for img in soup.find_all("img", class_="symbole-ressource"):
        if "alt" in img.attrs:
            element = clean_text(img["alt"])
            if element and element not in analysis["elements"]:
                analysis["elements"].append(element)
    
    # Extraction des mots-clés
    keywords_div = soup.find("div", class_="keywords")
    if keywords_div:
        analysis["keywords"] = [clean_text(span.text) for span in keywords_div.find_all("span") if clean_text(span.text)]
    
    return analysis

def analyze_all_card_types():
    """Analyse tous les types de cartes"""
    results = {}
    
    for card_type, url in SAMPLE_CARDS.items():
        try:
            results[card_type] = download_and_analyze_card(card_type, url)
            # Pause pour éviter de surcharger le serveur
            time.sleep(1)
        except Exception as e:
            print(f"Erreur lors de l'analyse de {card_type}: {str(e)}")
    
    # Sauvegarde des résultats
    os.makedirs("analysis", exist_ok=True)
    with open("analysis/card_types_analysis.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Affichage des différences de structure
    print("\nAnalyse des différences de structure entre les types de cartes :")
    for card_type, data in results.items():
        print(f"\n{card_type}:")
        for key, value in data.items():
            if isinstance(value, dict):
                print(f"  {key}:")
                for sub_key, sub_value in value.items():
                    print(f"    {sub_key}: {sub_value}")
            elif isinstance(value, list):
                print(f"  {key}: {len(value)} éléments")
                if value:
                    print(f"    Exemples: {', '.join(str(x) for x in value[:3])}")
            else:
                print(f"  {key}: {value}")

if __name__ == "__main__":
    analyze_all_card_types() 