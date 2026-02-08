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
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { AccountHomeScreen } from './src/screens/AccountHomeScreen';
import { ProfilePhotoScreen } from './src/screens/ProfilePhotoScreen';
import { AppSettingsScreen } from './src/screens/AppSettingsScreen';
import { PreferencesHomeScreen } from './src/screens/PreferencesHomeScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';
import { HomeHubScreen } from './src/screens/HomeHubScreen';
import { SearchHubScreen } from './src/screens/SearchHubScreen';
import { TripsHubScreen } from './src/screens/TripsHubScreen';
import { MessagesHubScreen } from './src/screens/MessagesHubScreen';
import { HelpCenterScreen } from './src/screens/HelpCenterScreen';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/auth';
import { ToastProvider } from './src/ui/ToastContext';
import { ModalProvider } from './src/ui/ModalContext';
import { getMessagingWsUrl, getNotifications } from './src/api/messaging';
import { SavedRidesProvider } from './src/savedRides';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const TripsStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();

const sectionHeaderOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTitleStyle: { color: colors.slate900 },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={sectionHeaderOptions}>
      <HomeStack.Screen name="HomeHub" component={HomeHubScreen} options={{ title: 'Accueil' }} />
      <HomeStack.Screen name="HomeFeed" component={HomeScreen} options={{ title: 'Vue generale' }} />
      <HomeStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Aide' }} />
    </HomeStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={sectionHeaderOptions}>
      <SearchStack.Screen name="SearchHub" component={SearchHubScreen} options={{ title: 'Explorer' }} />
      <SearchStack.Screen name="SearchForm" component={SearchScreen} options={{ title: 'Rechercher' }} />
      <SearchStack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoris' }} />
      <SearchStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Aide' }} />
    </SearchStack.Navigator>
  );
}

function TripsStackNavigator() {
  return (
    <TripsStack.Navigator screenOptions={sectionHeaderOptions}>
      <TripsStack.Screen name="TripsHub" component={TripsHubScreen} options={{ title: 'Mes trajets' }} />
      <TripsStack.Screen name="TripsList" component={TripsScreen} options={{ title: 'Historique' }} />
      <TripsStack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoris' }} />
      <TripsStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Aide' }} />
    </TripsStack.Navigator>
  );
}

function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={sectionHeaderOptions}>
      <MessagesStack.Screen name="MessagesHub" component={MessagesHubScreen} options={{ title: 'Messagerie' }} />
      <MessagesStack.Screen name="MessagesInbox" component={MessagesScreen} options={{ title: 'Conversations' }} />
      <MessagesStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Aide' }} />
    </MessagesStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={sectionHeaderOptions}
    >
      <ProfileStack.Screen name="AccountHome" component={AccountHomeScreen} options={{ title: 'Compte' }} />
      <ProfileStack.Screen name="PreferencesHome" component={PreferencesHomeScreen} options={{ title: 'Preferences' }} />
      <ProfileStack.Screen name="ProfileDetails" component={ProfileScreen} options={{ title: 'Mon profil' }} />
      <ProfileStack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} options={{ title: 'Photo de profil' }} />
      <ProfileStack.Screen name="AppSettings" component={AppSettingsScreen} options={{ title: "Parametres de l'app" }} />
      <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      <ProfileStack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoris' }} />
      <ProfileStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Aide' }} />
    </ProfileStack.Navigator>
  );
}

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
        if (!token) return;
        socket.send(JSON.stringify({ type: 'subscribe', token }));
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
  }, [account?.id, token]);

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
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ title: 'Accueil', headerShown: false }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{ title: 'Explorer', headerShown: false }}
      />
      {token ? (
        <Tab.Screen
          name="Trips"
          component={TripsStackNavigator}
          options={{ title: 'Trajets', headerShown: false }}
        />
      ) : null}
      {token ? (
        <Tab.Screen
          name="MessagesTab"
          component={MessagesStackNavigator}
          options={{
            title: 'Messagerie',
            headerShown: false,
            tabBarBadge: messageBadge > 0 ? messageBadge : undefined,
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ title: 'Compte', headerShown: false }}
      />
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
        <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoris' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <SavedRidesProvider>
          <ModalProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </ModalProvider>
        </SavedRidesProvider>
      </AuthProvider>
    </>
  );
}
