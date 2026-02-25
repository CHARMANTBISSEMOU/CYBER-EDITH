import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ActiveContractInfo {
  id_bien: string;
  date_fin: string; // formatted date
  jours_restants: number;
  label: string; // e.g. "Disponible dans 3 mois" or "Disponible dans 15 jours"
}

/**
 * Parse a date in DD/MM/YYYY format
 */
function parseDateDMY(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Calculate end date from start date + duration in months
 */
function calculateEndDate(startDate: string, months: number): Date | null {
  const start = parseDateDMY(startDate);
  if (!start) return null;
  start.setMonth(start.getMonth() + months);
  return start;
}

/**
 * Load active contracts from AsyncStorage and return a map of id_bien -> ActiveContractInfo
 */
export async function getActiveContractsMap(): Promise<Map<string, ActiveContractInfo>> {
  const map = new Map<string, ActiveContractInfo>();
  try {
    const stored = await AsyncStorage.getItem('local_contracts');
    if (!stored) return map;
    const contracts = JSON.parse(stored);
    const now = new Date();

    for (const c of contracts) {
      if (c.statut !== 'actif' || !c.id_bien || !c.date_debut) continue;

      const duree = c.duree_mois || 12;
      const endDate = calculateEndDate(c.date_debut, duree);
      if (!endDate || endDate <= now) continue;

      const diffMs = endDate.getTime() - now.getTime();
      const joursRestants = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let label: string;
      if (joursRestants > 60) {
        const mois = Math.round(joursRestants / 30);
        label = `Disponible dans ${mois} mois`;
      } else if (joursRestants > 1) {
        label = `Disponible dans ${joursRestants} jours`;
      } else {
        label = 'Bientôt disponible';
      }

      const dateFin = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;

      map.set(c.id_bien, {
        id_bien: c.id_bien,
        date_fin: dateFin,
        jours_restants: joursRestants,
        label,
      });
    }
  } catch (e) {
    console.warn('Erreur lecture contrats actifs:', e);
  }
  return map;
}
