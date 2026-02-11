import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { BienDetailScreen } from '../screens/bien/BienDetailScreen';
import { EditBienScreen } from '../screens/bien/EditBienScreen';
import { SearchScreen } from '../screens/bien/SearchScreen';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { MyPropertiesScreen } from '../screens/profile/MyPropertiesScreen';
import { MyContractsScreen } from '../screens/profile/MyContractsScreen';
import { PaymentsScreen } from '../screens/profile/PaymentsScreen';
import { GeolocationScreen } from '../screens/profile/GeolocationScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { OptionBPaymentScreen } from '../screens/payment/OptionBPaymentScreen';
import { AddBienScreen } from '../screens/bien/AddBienScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';
import { ContractsScreen } from '../screens/contracts/ContractsScreen';
import { ContractDetailScreen } from '../screens/contracts/ContractDetailScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { GpsAntiCheatingScreen } from '../screens/gps/GpsAntiCheatingScreen';
import { PaymentsHistoryScreen } from '../screens/payments/PaymentsHistoryScreen';
import { CreateContractScreen } from '../screens/contracts/CreateContractScreen';
import { NavigationScreen } from '../screens/bien/NavigationScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const HomeTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#1e293b',
        borderTopColor: '#334155',
        borderTopWidth: 1,
        paddingBottom: 8,
        paddingTop: 8,
        height: 60,
      },
      tabBarActiveTintColor: '#3b82f6',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: any;

        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Messages') {
          iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen}
      options={{ tabBarLabel: 'Accueil' }}
    />
    <Tab.Screen 
      name="Messages" 
      component={MessagesScreen}
      options={{ tabBarLabel: 'Messages' }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ tabBarLabel: 'Profil' }}
    />
  </Tab.Navigator>
);

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeTabs" component={HomeTabs} />
    <Stack.Screen 
      name="BienDetail" 
      component={BienDetailScreen}
      options={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#fff',
        headerTitle: 'Détails du bien',
      }}
    />
    <Stack.Screen 
      name="Navigation" 
      component={NavigationScreen}
      options={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#fff',
        headerTitle: 'Itinéraire',
      }}
    />
    <Stack.Screen 
      name="EditBien" 
      component={EditBienScreen}
      options={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#fff',
        headerTitle: 'Modifier le bien',
      }}
    />
    <Stack.Screen 
      name="Search" 
      component={SearchScreen}
      options={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#fff',
        headerTitle: 'Recherche',
      }}
    />
    <Stack.Screen 
      name="EditProfile" 
      component={EditProfileScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="MyProperties" 
      component={MyPropertiesScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="MyContracts" 
      component={MyContractsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Payments" 
      component={PaymentsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Geolocation" 
      component={GeolocationScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Settings" 
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="OptionBPayment" 
      component={OptionBPaymentScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="AddBien" 
      component={AddBienScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Contracts" 
      component={ContractsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="ContractDetail" 
      component={ContractDetailScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Notifications" 
      component={NotificationsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="GpsAntiCheating" 
      component={GpsAntiCheatingScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="PaymentsHistory" 
      component={PaymentsHistoryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="CreateContract" 
      component={CreateContractScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
