import React, { useEffect, useState } from 'react';
import { cardsDB } from '../lib/db';

interface Card {
    _id: string;
    name: string;
    imageUrl: string;
}

export default function Collection() {
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadCards() {
            try {
                console.log('Tentative de chargement des cartes depuis PouchDB...');
                const result = await cardsDB.allDocs({
                    include_docs: true
                });
                
                console.log(`Nombre de cartes trouvées: ${result.rows.length}`);
                
                if (result.rows.length === 0) {
                    setError('Aucune carte trouvée dans la base de données');
                    setLoading(false);
                    return;
                }

                const loadedCards = result.rows.map(row => {
                    const doc = row.doc as Card;
                    console.log(`Chargement de la carte: ${doc.name} avec l'image: ${doc.imageUrl}`);
                    return doc;
                });

                setCards(loadedCards);
                setLoading(false);
            } catch (err) {
                console.error('Erreur détaillée lors du chargement des cartes:', err);
                setError('Erreur lors du chargement des cartes. Vérifiez la console pour plus de détails.');
                setLoading(false);
            }
        }

        loadCards();
    }, []);

    if (loading) {
        return <div className="p-4">Chargement des cartes...</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-red-600">
                <h2 className="text-xl font-bold mb-2">Erreur</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Ma Collection ({cards.length} cartes)</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {cards.map(card => (
                    <div key={card._id} className="border rounded-lg p-2 hover:shadow-lg transition-shadow">
                        <img 
                            src={card.imageUrl} 
                            alt={card.name}
                            className="w-full h-auto"
                            loading="lazy"
                            onError={(e) => {
                                console.error(`Erreur de chargement de l'image pour ${card.name}:`, card.imageUrl);
                                e.currentTarget.src = './images/placeholder.png';
                            }}
                        />
                        <p className="mt-2 text-center text-sm font-medium">{card.name}</p>
                    </div>
                ))}
            </div>
        </div>
    );
} 