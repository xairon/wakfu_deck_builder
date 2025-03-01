import json
import os
from typing import Dict, List, Any
from urllib.parse import urljoin
from firecrawl import FirecrawlApp
import re
from bs4 import BeautifulSoup
import markdown

BASE_URL = "https://www.wtcg-return.fr"
EXTENSIONS = {
    "incarnam": "/cartes/incarnam/liste",
    "astrub": "/cartes/astrub/liste",
    "amakna": "/cartes/amakna/liste",
    "dofus_collection": "/cartes/dofus-collection/liste"
}

API_KEY = 'fc-c548ce378f7a4db2a2485c4d39597626'

def scrape_card(url: str, app: FirecrawlApp) -> Dict[str, Any]:
    """Scrape une carte individuelle en utilisant Firecrawl"""
    try:
        print(f"\nAnalyse de la carte : {url}")
        response = app.scrape_url(url=url, params={
            'formats': ['markdown'],
            'wait_for': ['img.round-card']  # Attend que l'image de la carte soit chargée
        })
        
        if response and response.get('content'):
            card_data = parse_card_content(response['content'])
            card_data["url"] = url
            
            # Vérifie la face arrière
            if 'back_face_url' in response:
                back_face_url = response['back_face_url']
                print(f"Face arrière trouvée: {back_face_url}")
                card_data["face_arriere"] = scrape_card(back_face_url, app)
                
            return card_data
            
    except Exception as e:
        print(f"Erreur lors du scraping de {url}: {str(e)}")
        return None

def extract_number(text: str) -> int:
    """Extrait un nombre d'une chaîne de caractères"""
    if not text:
        return None
    match = re.search(r'\d+', text)
    return int(match.group()) if match else None

def clean_text(text: str) -> str:
    """Nettoie le texte en enlevant les espaces inutiles"""
    return ' '.join(text.split()) if text else ''

def parse_card_content(content: str) -> Dict[str, Any]:
    """Parse le contenu markdown de la carte pour extraire les données"""
    card_data = {
        "name": None,
        "type": None,
        "class": None,
        "image_id": None,
        "stats": {
            "PA": None,
            "PM": None,
            "PV": None,
            "force": None,
            "niveau": None
        },
        "keywords": [],
        "effects": [],
        "notes": [],
        "rarete": None,
        "rarete_image_id": None,
        "element": None,
        "element_image_ids": [],
        "effect_image_ids": [],
        "artiste": None,
        "extension": None,
        "numero": None,
        "extension_id": None,
        "face_arriere": None,
        "ambiance": None
    }

    # Convertit le markdown en HTML pour un parsing plus facile
    html = markdown.markdown(content)
    soup = BeautifulSoup(html, 'html.parser')

    try:
        # Nom et type
        title = soup.find('h1')
        if title:
            type_elem = title.find('small', class_='text-muted')
            if type_elem:
                card_data["type"] = clean_text(type_elem.text)
                card_data["name"] = clean_text(title.text.replace(type_elem.text, ""))
            else:
                card_data["name"] = clean_text(title.text)

        # Stats
        stats_div = soup.find('div', class_='hstack gap-3')
        if stats_div:
            for stat in stats_div.find_all('div'):
                text = clean_text(stat.text)
                if "PA" in text:
                    card_data["stats"]["PA"] = extract_number(text)
                elif "PM" in text:
                    card_data["stats"]["PM"] = extract_number(text)
                elif "PV" in text:
                    card_data["stats"]["PV"] = extract_number(text)
                elif "Force" in text:
                    card_data["stats"]["force"] = extract_number(text)
                elif "Niveau" in text:
                    card_data["stats"]["niveau"] = extract_number(text)

        # Effets
        effects_div = soup.find('div', string=re.compile(r'Effets\s*:'))
        if effects_div:
            effects_list = effects_div.find_next('ul')
            if effects_list:
                for effect in effects_list.find_all('li'):
                    effect_text = clean_text(effect.text)
                    if effect_text:
                        card_data["effects"].append(effect_text)
                    # Récupère les IDs des images d'effet
                    for img in effect.find_all('img'):
                        if img.get('src'):
                            img_id = img['src'].split('/')[-1].split('.')[0]
                            card_data["effect_image_ids"].append(img_id)

        # Notes
        notes_div = soup.find('div', string=re.compile(r'Notes\s*:'))
        if notes_div:
            notes_list = notes_div.find_next('ul')
            if notes_list:
                card_data["notes"] = [clean_text(note.text) for note in notes_list.find_all('li')]

        # Rareté
        rarity_div = soup.find('div', string=re.compile(r'Rareté\s*:'))
        if rarity_div:
            badge = rarity_div.find('span', class_='badge')
            if badge:
                card_data["rarete"] = clean_text(badge.get('title', ''))
                rarete_classes = [c for c in badge.get('class', []) if c.startswith('rarete-')]
                if rarete_classes:
                    card_data["rarete_image_id"] = rarete_classes[0].replace('rarete-', '')

        # Extension
        extension_div = soup.find('div', string=re.compile(r'Extension\s*:'))
        if extension_div:
            text = clean_text(extension_div.text)
            match = re.search(r'Extension\s*:\s*([^\d]+)\s*(\d+)/(\d+)', text)
            if match:
                card_data["extension"] = clean_text(match.group(1))
                card_data["numero"] = match.group(2)
                card_data["extension_id"] = int(match.group(2))

        # Artiste
        artist_div = soup.find('div', string=re.compile(r'Artistes?\s*:'))
        if artist_div:
            text = clean_text(artist_div.text)
            if ':' in text:
                card_data["artiste"] = clean_text(text.split(':', 1)[1])

        # Image
        card_img = soup.find('img', class_='round-card')
        if card_img and card_img.get('src'):
            card_data["image_id"] = card_img['src'].split('/')[-1].split('.')[0]

        # Classe
        class_div = soup.find('div', string=re.compile(r'Classe\s*:'))
        if class_div:
            next_div = class_div.find_next('div')
            if next_div:
                card_data["class"] = clean_text(next_div.text)

        # Ambiance
        for div in soup.find_all('div', class_='mb-2'):
            text = div.text
            if '—' in text:
                card_data["ambiance"] = clean_text(text)

        # Éléments
        for img in soup.find_all('img', class_='symbole-ressource'):
            if img.get('src'):
                img_id = img['src'].split('/')[-1].split('.')[0]
                if img_id not in card_data["element_image_ids"]:
                    card_data["element_image_ids"].append(img_id)

        return card_data

    except Exception as e:
        print(f"Erreur lors du parsing du contenu: {str(e)}")
        return card_data

def scrape_extension(extension_name: str, extension_url: str, app: FirecrawlApp) -> List[Dict[str, Any]]:
    """Scrape toutes les cartes d'une extension en utilisant Firecrawl"""
    cards = []
    full_url = urljoin(BASE_URL, extension_url)
    
    try:
        print(f"Chargement de {full_url}...")
        response = app.scrape_url(url=full_url, params={
            'formats': ['markdown'],
            'wait_for': ['a[href*="/cartes/"]']
        })
        
        if response and response.get('links'):
            card_links = [link for link in response['links'] if "/liste" not in link]
            total_cards = len(card_links)
            print(f"Extension {extension_name}: {total_cards} cartes trouvées")
            
            for i, card_url in enumerate(card_links, 1):
                print(f"Traitement de la carte {i}/{total_cards}: {card_url}")
                card_data = scrape_card(card_url, app)
                if card_data:
                    cards.append(card_data)
                
    except Exception as e:
        print(f"Erreur lors du scraping de l'extension {extension_name}: {str(e)}")
        
    return cards

def scrape_all_cards():
    """Scrape toutes les cartes de toutes les extensions"""
    app = FirecrawlApp(api_key=API_KEY)
    all_cards = {}
    
    for ext_name, ext_url in EXTENSIONS.items():
        print(f"\nScraping de l'extension {ext_name}...")
        all_cards[ext_name] = scrape_extension(ext_name, ext_url, app)
        
    # Sauvegarde les données dans un fichier JSON
    output_dir = "data"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "cards.json")
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_cards, f, ensure_ascii=False, indent=2)
        
    print(f"\nDonnées sauvegardées dans {output_file}")

if __name__ == "__main__":
    scrape_all_cards() 