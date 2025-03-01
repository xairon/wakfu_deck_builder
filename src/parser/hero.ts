export function parseHeroFace(filePath: string, $: CheerioAPI): BaseCard {
  try {
    console.log(`\n=== Début du parsing de ${filePath} ===\n`);
    
    // Extraction du nom et du type
    console.log('1. Extraction du nom et du type...');
    const h1 = $('h1').first();
    console.log('h1 trouvé:', h1.length > 0 ? 'Oui' : 'Non');
    if (!h1.length) {
      console.log('HTML complet:', $.html());
      throw new Error('Balise h1 non trouvée');
    }
    console.log('Contenu HTML de h1:', h1.html());

    const cardName = h1.contents().filter(function() {
      return this.type === 'text';
    }).text().trim();
    console.log('Nom de la carte extrait:', cardName);
    
    if (!cardName) {
      console.log('Contenu complet de h1:', h1.text());
      throw new Error('Nom de la carte non trouvé');
    }
    
    console.log(`Carte identifiée: ${cardName} (Héros)`);

    // Extraction des sous-types
    console.log('\n2. Extraction des sous-types...');
    const subtypeContainer = $('.row .hstack.gap-3, .hstack.gap-3').first();
    console.log('Container de sous-types trouvé:', subtypeContainer.length > 0 ? 'Oui' : 'Non');
    
    if (!subtypeContainer.length) {
      console.log('Tous les containers hstack.gap-3:');
      $('.hstack.gap-3').each((i, el) => {
        console.log(`Container ${i}:`, $(el).html());
      });
      console.log('HTML complet:', $.html());
      throw new Error('Container de sous-types non trouvé');
    }

    console.log('Contenu HTML du container de sous-types:');
    console.log(subtypeContainer.html());

    const subtypes = subtypeContainer.find('div').map((_, el) => {
      const text = $(el).text().trim();
      console.log('Sous-type trouvé:', text);
      return text;
    }).get().filter(type => type !== 'Héros');
    
    console.log(`Sous-types filtrés: ${JSON.stringify(subtypes)}`);

    // Extraction des stats de base (PA, PM, PV)
    console.log('\n3. Extraction des stats de base...');
    const baseStatsContainer = $('.row .hstack.gap-3, .hstack.gap-3').eq(1);
    console.log('Container de stats de base trouvé:', baseStatsContainer.length > 0 ? 'Oui' : 'Non');
    
    if (!baseStatsContainer.length) {
      console.log('Tous les containers hstack.gap-3:');
      $('.hstack.gap-3').each((i, el) => {
        console.log(`Container ${i}:`, $(el).html());
      });
      throw new Error('Container de stats de base non trouvé');
    }

    console.log('Contenu HTML du container de stats de base:');
    console.log(baseStatsContainer.html());

    const baseStats: { [key: string]: number } = {};
    baseStatsContainer.find('div').each((_, el) => {
      const text = $(el).text().trim();
      console.log(`Analyse de la stat de base: "${text}"`);
      const [stat, value] = text.split(':').map(s => s.trim());
      if (stat && value) {
        baseStats[stat] = parseInt(value);
        console.log(`Stat de base ajoutée: ${stat} = ${baseStats[stat]}`);
      } else {
        console.log(`Format invalide pour la stat: "${text}"`);
      }
    });

    console.log('Stats de base complètes:', baseStats);
    if (!baseStats.PA || !baseStats.PM || !baseStats.PV) {
      console.log('Stats manquantes:', {
        PA: baseStats.PA,
        PM: baseStats.PM,
        PV: baseStats.PV
      });
      throw new Error('Stats de base incomplètes');
    }

    // Extraction du niveau et de la force
    console.log('\n4. Extraction du niveau et de la force...');
    const levelContainer = $('.row .hstack.gap-3, .hstack.gap-3').eq(2);
    console.log('Container de niveau/force trouvé:', levelContainer.length > 0 ? 'Oui' : 'Non');
    
    if (!levelContainer.length) {
      console.log('Tous les containers hstack.gap-3:');
      $('.hstack.gap-3').each((i, el) => {
        console.log(`Container ${i}:`, $(el).html());
      });
      throw new Error('Container de niveau non trouvé');
    }

    console.log('Contenu HTML du container de niveau/force:');
    console.log(levelContainer.html());

    const stats: { [key: string]: { value: number; element: string } } = {};

    levelContainer.find('div').each((_, el) => {
      const text = $(el).text().trim();
      console.log(`\nAnalyse de la stat: "${text}"`);

      if (text.includes('Niveau')) {
        console.log('Parsing du niveau...');
        const levelMatch = text.match(/Niveau\s*:\s*(\d+)/);
        console.log('Match du niveau:', levelMatch);
        
        if (levelMatch) {
          const levelValue = parseInt(levelMatch[1]);
          console.log(`Valeur du niveau: ${levelValue}`);

          const elementImg = $(el).find('img.symbole-ressource').first();
          console.log('Image d\'élément trouvée:', elementImg.length > 0 ? 'Oui' : 'Non');
          
          if (!elementImg.length) {
            console.log('Contenu HTML complet de l\'élément:', $(el).html());
            console.log('Image d\'élément non trouvée pour le niveau');
            return;
          }
          
          console.log('Attributs de l\'image:');
          console.log('- class:', elementImg.attr('class'));
          console.log('- alt:', elementImg.attr('alt'));
          console.log('- src:', elementImg.attr('src'));
          
          const elementAlt = elementImg.attr('alt')?.toLowerCase();
          console.log(`Élément extrait depuis alt: ${elementAlt}`);
          
          if (elementAlt) {
            stats.niveau = {
              value: levelValue,
              element: elementAlt
            };
            console.log(`Stat niveau complète: ${JSON.stringify(stats.niveau, null, 2)}`);
          } else {
            console.log('Élément non trouvé dans l\'attribut alt');
          }
        } else {
          console.log('Format du niveau invalide');
        }
      } else if (text.includes('Force')) {
        console.log('Parsing de la force...');
        const forceMatch = text.match(/Force\s*:\s*(\d+)/);
        console.log('Match de la force:', forceMatch);
        
        if (forceMatch) {
          const forceValue = parseInt(forceMatch[1]);
          console.log(`Valeur de la force: ${forceValue}`);

          const elementImg = $(el).find('img.symbole-ressource').first();
          console.log('Image d\'élément trouvée:', elementImg.length > 0 ? 'Oui' : 'Non');
          
          if (!elementImg.length) {
            console.log('Contenu HTML complet de l\'élément:', $(el).html());
            console.log('Image d\'élément non trouvée pour la force');
            return;
          }
          
          console.log('Attributs de l\'image:');
          console.log('- class:', elementImg.attr('class'));
          console.log('- alt:', elementImg.attr('alt'));
          console.log('- src:', elementImg.attr('src'));
          
          const elementAlt = elementImg.attr('alt')?.toLowerCase();
          console.log(`Élément extrait depuis alt: ${elementAlt}`);
          
          if (elementAlt) {
            stats.force = {
              value: forceValue,
              element: elementAlt
            };
            console.log(`Stat force complète: ${JSON.stringify(stats.force, null, 2)}`);
          } else {
            console.log('Élément non trouvé dans l\'attribut alt');
          }
        } else {
          console.log('Format de la force invalide');
        }
      }
    });

    console.log('\nVérification des stats finales:');
    if (!stats.niveau) {
      console.log('Stats actuelles:', stats);
      throw new Error('Niveau non trouvé');
    }
    console.log(`Niveau final: ${stats.niveau.value} ${stats.niveau.element}`);

    if (!stats.force) {
      console.log('Stats actuelles:', stats);
      throw new Error('Force non trouvée');
    }
    console.log(`Force finale: ${stats.force.value} ${stats.force.element}`);

    // Construction de l'objet de base
    console.log('\n5. Construction de l\'objet de base...');
    const baseObject: BaseCard = {
      name: cardName,
      type: 'Héros',
      subtypes,
      elements: [],
      baseStats,
      stats,
      effects: [],
      keywords: [],
      rarity: 'Fixe',
      extension: '',
      number: 0,
      flavor: '',
      imageUrl: ''
    };

    // Extraction des effets
    console.log('\n6. Extraction des effets...');
    const effectsContainer = $('.row div, div').filter((_, el) => $(el).text().trim().startsWith('Effets :'));
    console.log('Container d\'effets trouvé:', effectsContainer.length > 0 ? 'Oui' : 'Non');
    
    if (effectsContainer.length) {
      console.log('Contenu HTML du container d\'effets:');
      console.log(effectsContainer.html());
      
      const effectsList = effectsContainer.find('ul li').map((_, el) => {
        const effect = $(el).text().trim();
        console.log('Effet trouvé:', effect);
        return effect;
      }).get();
      
      baseObject.effects = effectsList;
      console.log('Liste des effets:', effectsList);
    } else {
      console.log('Aucun effet trouvé');
    }

    // Extraction de l'extension et du numéro
    console.log('\n7. Extraction de l\'extension et du numéro...');
    const extensionText = $('.row div, div').filter((_, el) => $(el).text().trim().startsWith('Extension :')).text();
    console.log('Texte de l\'extension:', extensionText);
    
    if (extensionText) {
      const [extension, number] = extensionText.replace('Extension :', '').trim().split(/\s+(?=\d)/);
      baseObject.extension = extension.trim();
      console.log('Extension extraite:', baseObject.extension);
      
      if (number) {
        const [cardNumber] = number.split('/');
        baseObject.number = parseInt(cardNumber);
        console.log('Numéro extrait:', baseObject.number);
      } else {
        console.log('Numéro non trouvé dans:', number);
      }
    } else {
      console.log('Information d\'extension non trouvée');
    }

    // Extraction de l'URL de l'image
    console.log('\n8. Extraction de l\'URL de l\'image...');
    const imageUrl = $('.round-card').attr('src');
    console.log('URL de l\'image trouvée:', imageUrl);
    
    if (imageUrl) {
      baseObject.imageUrl = imageUrl;
    } else {
      console.log('Image non trouvée dans le HTML');
    }

    console.log('\n=== Parsing terminé avec succès ===\n');
    return baseObject;
  } catch (error) {
    console.error(`\n!!! Erreur lors du parsing de ${filePath} !!!`);
    console.error('Message d\'erreur:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

function extractSubTypes($: CheerioAPI): string[] {
  const subTypes: string[] = [];
  $(".hstack.gap-3").first().find("div").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text !== "Héros") {
      subTypes.push(text);
    }
  });
  return subTypes;
}

function extractFlavor($: CheerioAPI): { text: string; attribution?: string } | undefined {
  const flavorDiv = $('div:contains("Ambiance :")');
  if (flavorDiv.length === 0) return undefined;
  
  const text = flavorDiv.find("p").text().trim();
  if (!text) return undefined;
  
  const parts = text.split("-").map(s => s.trim());
  return parts.length > 1 
    ? { text: parts[0], attribution: parts[1] }
    : { text };
}

function extractPA($container: Cheerio<Element>): number {
  const paText = $container.find("div:contains('PA')").text().trim();
  const pa = parseInt(paText.replace("PA :", "").trim());
  return pa;
}

function extractPM($container: Cheerio<Element>): number {
  const pmText = $container.find("div:contains('PM')").text().trim();
  const pm = parseInt(pmText.replace("PM :", "").trim());
  return pm;
}

function extractPV($container: Cheerio<Element>): number {
  const pvText = $container.find("div:contains('PV')").text().trim();
  const pv = parseInt(pvText.replace("PV :", "").trim());
  return pv;
}

function extractBaseStats($: CheerioAPI): BaseStats {
  const baseStats: BaseStats = {
    niveau: undefined,
    force: undefined,
  };

  const statsContainer = $(".hstack.gap-3").eq(2);
  const statsText = statsContainer.text().trim();
  console.log("Texte de stat trouvé:", statsText);

  // Extraction du niveau
  const niveauMatch = statsText.match(/Niveau\s*:\s*(\d+)/);
  if (niveauMatch) {
    const niveauValue = parseInt(niveauMatch[1]);
    console.log("Niveau trouvé:", niveauValue);

    const niveauElement = statsContainer.find("img.symbole-ressource").first();
    const elementAlt = niveauElement.attr("alt")?.toLowerCase();
    console.log("Image élément niveau:", niveauElement.attr("class"));
    if (elementAlt) {
      const mappedElement = mapElement(elementAlt);
      console.log("Élément trouvé depuis alt:", elementAlt, "=>", mappedElement);
      console.log("Élément trouvé pour le niveau:", mappedElement);
      baseStats.niveau = {
        value: niveauValue,
        element: mappedElement as CardElement,
      };
      console.log("Stat niveau ajoutée:", baseStats.niveau);
    }
  }

  // Extraction de la force
  const forceMatch = statsText.match(/Force\s*:\s*(\d+)/);
  if (forceMatch) {
    const forceValue = parseInt(forceMatch[1]);
    console.log("Force trouvée:", forceValue);

    const forceElement = statsContainer.find("img.symbole-ressource").last();
    const elementAlt = forceElement.attr("alt")?.toLowerCase();
    console.log("Image élément force:", forceElement.attr("class"));
    if (elementAlt) {
      const mappedElement = mapElement(elementAlt);
      console.log("Élément trouvé depuis alt:", elementAlt, "=>", mappedElement);
      console.log("Élément trouvé pour la force:", mappedElement);
      baseStats.force = {
        value: forceValue,
        element: mappedElement as CardElement,
      };
      console.log("Stat force ajoutée:", baseStats.force);
    }
  }

  if (baseStats.niveau) {
    console.log("Niveau final:", baseStats.niveau.value, baseStats.niveau.element);
  }
  if (baseStats.force) {
    console.log("Force finale:", baseStats.force.value, baseStats.force.element);
  }

  return baseStats;
}

function extractEffects($: CheerioAPI): CardEffect[] {
  const effects: CardEffect[] = [];
  const effectsContainer = $(".flex-fill.ms-2 .row div:contains('Effets :')");
  
  if (effectsContainer.length > 0) {
    const effectsList = effectsContainer.find("ul li");
    effectsList.each((_, element) => {
      const effectText = $(element).text().trim();
      effects.push({
        text: effectText,
        keywords: extractKeywordsFromEffect(effectText),
      });
    });
  }
  
  return effects;
}

function extractKeywordsFromEffect(effectText: string): string[] {
  const keywords: string[] = [];
  // Ajoutez ici la logique pour extraire les mots-clés des effets
  return keywords;
}

function extractKeywords($: CheerioAPI): string[] {
  const keywords: string[] = [];
  // Ajoutez ici la logique pour extraire les mots-clés de la carte
  return keywords;
}

function extractImageUrl($: CheerioAPI): string {
  const imageUrl = $("img.round-card").attr("src");
  if (!imageUrl) {
    throw new Error("Image URL not found");
  }
  return imageUrl;
}

function extractRarity($: CheerioAPI): CardRarity {
  const rarityText = $(".flex-fill.ms-2 .row div:contains('Rareté :')").text().trim();
  if (rarityText.includes("Fixe")) return "fixe";
  if (rarityText.includes("Commune")) return "commune";
  if (rarityText.includes("Peu Commune")) return "peu-commune";
  if (rarityText.includes("Rare")) return "rare";
  if (rarityText.includes("Ultra Rare")) return "ultra-rare";
  throw new Error(`Unknown rarity: ${rarityText}`);
}

function extractExtension($: CheerioAPI): string {
  const extensionText = $(".flex-fill.ms-2 .row div:contains('Extension :')").text().trim();
  const extensionMatch = extensionText.match(/Extension\s*:\s*([^0-9]+)/);
  if (!extensionMatch) {
    throw new Error(`Extension not found in text: ${extensionText}`);
  }
  return extensionMatch[1].trim();
}

function extractElements($: CheerioAPI): CardElement[] {
  const elements: CardElement[] = [];
  const elementImages = $("img.symbole-ressource");
  
  elementImages.each((_, element) => {
    const alt = $(element).attr("alt")?.toLowerCase();
    if (alt) {
      const mappedElement = mapElement(alt);
      if (!elements.includes(mappedElement as CardElement)) {
        elements.push(mappedElement as CardElement);
      }
    }
  });
  
  return elements;
}

function mapElement(elementName: string): CardElement {
  const elementMap: Record<string, CardElement> = {
    feu: "feu",
    eau: "eau",
    terre: "terre",
    air: "air",
    neutre: "neutre",
  };
  
  const mappedElement = elementMap[elementName];
  if (!mappedElement) {
    throw new Error(`Unknown element: ${elementName}`);
  }
  
  return mappedElement;
} 