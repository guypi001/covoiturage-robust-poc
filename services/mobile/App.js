import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { RideDetailScreen } from './src/screens/RideDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { TripsScreen } from './src/screens/TripsScreen';
import { TripDetailScreen } from './src/screens/TripDetailScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { PublicProfileScreen } from './src/screens/PublicProfileScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/auth';
import { ToastProvider } from './src/ui/ToastContext';
import { ModalProvider } from './src/ui/ModalContext';
import { getMessagingWsUrl, getNotifications } from './src/api/messaging';

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
  const { token, account } = useAuth();
  const [messageBadge, setMessageBadge] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    let socket;
    const load = async () => {
      if (!account?.id) {
        setMessageBadge(0);
        return;
      }
      try {
        const res = await getNotifications(account.id);
        if (active) setMessageBadge(res?.unreadConversations ?? 0);
      } catch {
        if (active) setMessageBadge(0);
      }
    };
    load();
    if (account?.id) {
      socket = new WebSocket(getMessagingWsUrl());
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'subscribe', userId: account.id }));
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'message.read') {
            if (typeof payload?.data?.unreadConversations === 'number') {
              setMessageBadge(payload.data.unreadConversations);
            } else {
              load();
            }
          }
          if (payload?.type === 'message.new') {
            load();
          }
        } catch {
          // ignore
        }
      };
    }
    return () => {
      active = false;
      if (socket) socket.close();
    };
  }, [account?.id]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.slate900 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate200,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.slate500,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'ellipse';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
          if (route.name === 'Trips') iconName = focused ? 'car' : 'car-outline';
          if (route.name === 'MessagesTab') iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Recherche' }} />
      {token ? <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'Mes trajets' }} /> : null}
      {token ? (
        <Tab.Screen
          name="MessagesTab"
          component={MessagesScreen}
          options={{
            title: 'Messagerie',
            tabBarBadge: messageBadge > 0 ? messageBadge : undefined,
          }}
        />
      ) : null}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, guest, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

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
        <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Mes trajets' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversation' }} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profil conducteur' }} />
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
