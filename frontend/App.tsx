import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { RootStackParamList } from './src/navigation/types';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import PhoneScreen from './src/screens/PhoneScreen';
import OtpScreen from './src/screens/OtpScreen';
import CreateProfileScreen from './src/screens/CreateProfileScreen';
import RetailerNavigator from './src/navigation/RetailerNavigator';
import WholesalerNavigator from './src/navigation/WholesalerNavigator';
import MandiAdminHomeScreen from './src/screens/MandiAdminHomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Single source of truth for "what should be showing":
 * - not signed in             -> Phone / Otp
 * - signed in, no profile     -> CreateProfile
 * - mandi admin               -> admin home
 * - wholesaler                -> wholesaler home
 * - retailer                  -> retailer tabs
 *
 * TODO: when one account holds both a retailer and a wholesaler profile,
 * add a role switcher rather than silently picking one.
 */
function RootNavigator() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#15265E',
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const profiles = user?.profiles;
  const hasAnyProfile =
    !!profiles?.retailer || !!profiles?.wholesaler || !!profiles?.mandiAdmin;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Phone" component={PhoneScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
        </>
      ) : !hasAnyProfile ? (
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
      ) : profiles?.mandiAdmin ? (
        <Stack.Screen name="MandiAdminHome" component={MandiAdminHomeScreen} />
      ) : profiles?.wholesaler ? (
        <Stack.Screen name="Wholesaler" component={WholesalerNavigator} />
      ) : (
        <Stack.Screen name="Retailer" component={RetailerNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
