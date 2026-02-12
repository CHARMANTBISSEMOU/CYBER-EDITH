import AsyncStorage from '@react-native-async-storage/async-storage';

export const checkTokenExpiry = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return false;
    }
    
    // Vérifier si le token est expiré (simple validation)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    // Token expiré si plus de 24h
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Erreur vérification token:', error);
    return false;
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.error('Erreur nettoyage storage:', error);
  }
};
