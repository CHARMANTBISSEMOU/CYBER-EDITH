import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bienApi } from '../../services/bienApi';
import { getActiveContractsMap, ActiveContractInfo } from '../../utils/contractUtils';

export const SearchScreen = ({ navigation }: any) => {
  const [biens, setBiens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeContracts, setActiveContracts] = useState<Map<string, ActiveContractInfo>>(new Map());

  useEffect(() => {
    getActiveContractsMap().then(setActiveContracts);
  }, []);
  const [filters, setFilters] = useState({
    ville: '',
    quartier: '',
    type_bien: '',
    prix_min: '',
    prix_max: '',
    chambres_min: '',
    meuble: undefined as boolean | undefined,
  });

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      
      if (filters.ville) params.ville = filters.ville;
      if (filters.quartier) params.quartier = filters.quartier;
      if (filters.type_bien) params.type_bien = filters.type_bien;
      if (filters.prix_min) params.prix_min = parseInt(filters.prix_min);
      if (filters.prix_max) params.prix_max = parseInt(filters.prix_max);
      if (filters.chambres_min) params.chambres_min = parseInt(filters.chambres_min);
      if (filters.meuble !== undefined) params.meuble = filters.meuble;

      const response = await bienApi.searchBiens(params);
      setBiens(response.biens || []);
    } catch (error: any) {
      console.error('Erreur recherche:', error);
      Alert.alert('Erreur', 'Impossible d\'effectuer la recherche');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      ville: '',
      quartier: '',
      type_bien: '',
      prix_min: '',
      prix_max: '',
      chambres_min: '',
      meuble: undefined,
    });
  };

  const typeBiens = ['studio', 'maison', 'chambre', 'appartement', 'bureau', 'terrain'];

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: '700', marginBottom: 24 }}>Recherche avancée</Text>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Ville</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
              placeholder="Ex: Douala, Yaoundé..."
              placeholderTextColor="#94a3b8"
              value={filters.ville}
              onChangeText={(value) => updateFilter('ville', value)}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Quartier</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
              placeholder="Ex: Akwa, Bonanjo..."
              placeholderTextColor="#94a3b8"
              value={filters.quartier}
              onChangeText={(value) => updateFilter('quartier', value)}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Type de bien</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {typeBiens.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => updateFilter('type_bien', filters.type_bien === type ? '' : type)}
                  style={{
                    backgroundColor: filters.type_bien === type ? '#3b82f6' : '#f8fafc',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <Text style={{ color: filters.type_bien === type ? '#fff' : '#1e293b', textTransform: 'capitalize' }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Prix min (FCFA)</Text>
              <TextInput
                style={{ backgroundColor: '#f8fafc', color: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                value={filters.prix_min}
                onChangeText={(value) => updateFilter('prix_min', value)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Prix max (FCFA)</Text>
              <TextInput
                style={{ backgroundColor: '#f8fafc', color: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
                placeholder="1000000"
                placeholderTextColor="#94a3b8"
                value={filters.prix_max}
                onChangeText={(value) => updateFilter('prix_max', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Nombre de chambres minimum</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#1e293b', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              value={filters.chambres_min}
              onChangeText={(value) => updateFilter('chambres_min', value)}
              keyboardType="numeric"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Meublé</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => updateFilter('meuble', filters.meuble === true ? undefined : true)}
                style={{
                  flex: 1,
                  backgroundColor: filters.meuble === true ? '#3b82f6' : '#f8fafc',
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ color: filters.meuble === true ? '#fff' : '#1e293b', textAlign: 'center', fontWeight: '600' }}>
                  Oui
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateFilter('meuble', filters.meuble === false ? undefined : false)}
                style={{
                  flex: 1,
                  backgroundColor: filters.meuble === false ? '#3b82f6' : '#f8fafc',
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ color: filters.meuble === false ? '#fff' : '#1e293b', textAlign: 'center', fontWeight: '600' }}>
                  Non
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={resetFilters}
              style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
            >
              <Text style={{ color: '#1e293b', textAlign: 'center', fontWeight: '600' }}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={isLoading}
              style={{ flex: 1, backgroundColor: isLoading ? '#94a3b8' : '#3b82f6', padding: 16, borderRadius: 8 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Rechercher</Text>
              )}
            </TouchableOpacity>
          </View>

          {biens.length > 0 ? (
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
                {biens.length} résultat{biens.length > 1 ? 's' : ''}
              </Text>
              {biens.map((bien) => (
                <TouchableOpacity
                  key={bien.id_bien}
                  onPress={() => navigation.navigate('BienDetail', { id: bien.id_bien })}
                  style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 }}
                >
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{bien.titre}</Text>
                  <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                    {bien.type_bien} • {bien.ville}
                  </Text>
                  {bien.prix_loyer && (
                    <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600', marginTop: 8 }}>
                      {bien.prix_loyer.toLocaleString()} FCFA/mois
                    </Text>
                  )}
                  {activeContracts.has(bien.id_bien) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#f59e0b20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: 'flex-start' }}>
                      <Ionicons name="time-outline" size={14} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '600', marginLeft: 5 }}>
                        {activeContracts.get(bien.id_bien)!.label}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#10b98120', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: 'flex-start' }}>
                      <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600', marginLeft: 5 }}>Disponible</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : !isLoading && (
            <View style={{ marginTop: 24, backgroundColor: '#1e293b', borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={48} color="#6b7280" />
              <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 16, fontSize: 16 }}>
                Aucun bien ne correspond à vos critères de recherche.
              </Text>
              <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 8, fontSize: 14 }}>
                Essayez de modifier vos filtres pour obtenir plus de résultats.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
