export interface ContractData {
  type: 'location' | 'vente';
  bien: {
    titre: string;
    adresse: string;
    type: string;
  };
  bailleur_vendeur: string;
  locataire_acheteur: string;
  montant: number;
  caution?: number;
  date_debut: string;
  duree_mois?: number;
  conditions_speciales?: string;
}

export const generateContractLocal = (data: ContractData): string => {
  const today = new Date().toLocaleDateString('fr-FR');

  if (data.type === 'vente') {
    return `CONTRAT DE VENTE IMMOBILIÈRE

Fait le ${today}


ENTRE :

Le Vendeur : ${data.bailleur_vendeur}

ET

L'Acheteur : ${data.locataire_acheteur}


ARTICLE 1 — OBJET DE LA VENTE

Le Vendeur cède à l'Acheteur le bien suivant :
- Désignation : ${data.bien.titre}
- Type : ${data.bien.type}
- Adresse : ${data.bien.adresse}


ARTICLE 2 — PRIX DE VENTE

Prix convenu : ${data.montant.toLocaleString('fr-FR')} FCFA
Payable selon les modalités convenues entre les parties.


ARTICLE 3 — TRANSFERT DE PROPRIÉTÉ

Le transfert de propriété prend effet à compter de la signature du présent contrat et du paiement intégral du prix.


ARTICLE 4 — GARANTIES

Le Vendeur garantit :
- Être le propriétaire légitime du bien
- Que le bien est libre de toute hypothèque ou dette
- Que le bien est conforme à la description ci-dessus


ARTICLE 5 — CONDITIONS PARTICULIÈRES

${data.conditions_speciales || 'Néant'}


FAIT EN DOUBLE EXEMPLAIRE

Le Vendeur                          L'Acheteur



_____________________               _____________________
(Lu et approuvé)                    (Lu et approuvé)`;
  }

  const duree = data.duree_mois || 12;
  const endDate = calculateEndDate(data.date_debut, duree);

  return `CONTRAT DE LOCATION

Fait le ${today}


ENTRE :

Le Bailleur : ${data.bailleur_vendeur}

ET

Le Locataire : ${data.locataire_acheteur}


ARTICLE 1 — OBJET

Le Bailleur met en location le bien suivant :
- Désignation : ${data.bien.titre}
- Type : ${data.bien.type}
- Adresse : ${data.bien.adresse}


ARTICLE 2 — DURÉE

Durée : ${duree} mois
Du ${data.date_debut} au ${endDate}


ARTICLE 3 — LOYER

Loyer mensuel : ${data.montant.toLocaleString('fr-FR')} FCFA


ARTICLE 4 — CAUTION

${data.caution && data.caution > 0
    ? `Montant : ${data.caution.toLocaleString('fr-FR')} FCFA
Versée à la signature. Restituée en fin de bail, déduction faite des réparations éventuelles.`
    : 'Aucune caution exigée.'}


ARTICLE 5 — OBLIGATIONS DU BAILLEUR

- Remettre le bien en bon état
- Assurer la jouissance paisible
- Effectuer les grosses réparations


ARTICLE 6 — OBLIGATIONS DU LOCATAIRE

- Payer le loyer à temps
- Entretenir le bien
- Ne pas sous-louer sans accord
- Restituer le bien en bon état


ARTICLE 7 — RÉSILIATION

- Par le Locataire : préavis de 3 mois
- Par le Bailleur : en cas de non-paiement ou non-respect du contrat


ARTICLE 8 — CONDITIONS PARTICULIÈRES

${data.conditions_speciales || 'Néant'}


FAIT EN DOUBLE EXEMPLAIRE

Le Bailleur                         Le Locataire



_____________________               _____________________
(Lu et approuvé)                    (Lu et approuvé)`;
};

function calculateEndDate(startDate: string, months: number): string {
  const match = startDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  date.setMonth(date.getMonth() + months);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
