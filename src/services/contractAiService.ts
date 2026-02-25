import axios from 'axios';

const GEMINI_KEY = 'AIzaSyCk6HI5267Zh1Kym469xmylsMTjTOLxZ9U';

const MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
];

export interface ContractInput {
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string): Promise<string> {
  let lastError: any = null;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`🤖 Tentative Gemini: ${model} (essai ${attempt + 1})`);
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
            },
          },
          { timeout: 45000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Réponse Gemini vide');
        return text;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        if (status === 429) {
          console.warn(`⏳ Quota ${model} épuisé, attente 5s...`);
          await sleep(5000);
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error('Tous les modèles Gemini ont échoué');
}

export const contractAiService = {
  async generateContract(input: ContractInput): Promise<string> {
    const isLocation = input.type === 'location';

    const prompt = isLocation
      ? `Tu es un rédacteur de contrats immobiliers au Cameroun. Rédige un contrat de location simple et professionnel (2 pages max).
Réponds UNIQUEMENT avec le texte du contrat, sans commentaire ni explication.

Informations :
- Bailleur : ${input.bailleur_vendeur}
- Locataire : ${input.locataire_acheteur}
- Bien : ${input.bien.titre} (${input.bien.type})
- Adresse : ${input.bien.adresse}
- Loyer mensuel : ${input.montant.toLocaleString()} FCFA
- Caution : ${input.caution ? input.caution.toLocaleString() + ' FCFA' : 'Aucune'}
- Date de début : ${input.date_debut}
- Durée : ${input.duree_mois || 12} mois
${input.conditions_speciales ? '- Conditions particulières : ' + input.conditions_speciales : ''}

Le contrat doit être court, clair et direct. Pas de mention de lois.
Articles : Objet, Durée, Loyer, Caution, Obligations du bailleur (3 points), Obligations du locataire (4 points), Résiliation, Conditions particulières, Signatures.`
      : `Tu es un rédacteur de contrats immobiliers au Cameroun. Rédige un contrat de vente immobilière simple et professionnel (2 pages max).
Réponds UNIQUEMENT avec le texte du contrat, sans commentaire ni explication.

Informations :
- Vendeur : ${input.bailleur_vendeur}
- Acheteur : ${input.locataire_acheteur}
- Bien : ${input.bien.titre} (${input.bien.type})
- Adresse : ${input.bien.adresse}
- Prix de vente : ${input.montant.toLocaleString()} FCFA
${input.conditions_speciales ? '- Conditions particulières : ' + input.conditions_speciales : ''}

Le contrat doit être court, clair et direct. Pas de mention de lois.
Articles : Objet de la vente, Description du bien, Prix et modalités de paiement, Transfert de propriété, Garanties, Conditions particulières, Signatures.`;

    try {
      return await callGemini(prompt);
    } catch (error: any) {
      console.error('Erreur Gemini génération:', error?.response?.data || error.message);
      throw new Error('Impossible de générer le contrat via IA');
    }
  },

  async modifyContract(currentContract: string, instruction: string): Promise<string> {
    const prompt = `Tu es un assistant de rédaction de contrats immobiliers. On te donne un contrat existant et une demande de modification. Applique la modification et renvoie le contrat complet modifié.
Réponds UNIQUEMENT avec le contrat modifié, sans commentaire ni explication.

Contrat actuel :

${currentContract}

Modification demandée : ${instruction}`;

    try {
      return await callGemini(prompt);
    } catch (error: any) {
      console.error('Erreur Gemini modification:', error?.response?.data || error.message);
      throw new Error('Impossible de modifier le contrat via IA');
    }
  },
};
