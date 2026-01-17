import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { RideDetailScreen } from './src/screens/RideDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { TripsScreen } from './src/screens/TripsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/auth';
import { ToastProvider } from './src/ui/ToastContext';
import { ModalProvider } from './src/ui/ModalContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { token } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.slate900 },
        tabBarStyle: { backgroundColor: colors.white },
        tabBarActiveTintColor: colors.sky600,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Recherche' }} />
      {token ? <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'Mes trajets' }} /> : null}
      {token ? (
        <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ title: 'Messagerie' }} />
      ) : null}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, guest } = useAuth();

  if (!token && !guest) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Resultats' }} />
        <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: 'Trajet' }} />
        <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <ModalProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </ModalProvider>
      </AuthProvider>
    </>
  );
}
