import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { colors } from '../theme';
import type { RetailerStackParamList, RetailerTabParamList } from './types';
import HomeScreen from '../screens/retailer/HomeScreen';
import CategoriesScreen from '../screens/retailer/CategoriesScreen';
import BuyAgainScreen from '../screens/retailer/BuyAgainScreen';
import OrdersScreen from '../screens/retailer/OrdersScreen';
import ProfileScreen from '../screens/retailer/ProfileScreen';
import ProductDetailScreen from '../screens/retailer/ProductDetailScreen';
import CartScreen from '../screens/retailer/CartScreen';
import CheckoutScreen from '../screens/retailer/CheckoutScreen';
import OrderDetailScreen from '../screens/retailer/OrderDetailScreen';
import WalletScreen from '../screens/retailer/WalletScreen';

const Tab = createBottomTabNavigator<RetailerTabParamList>();
const Stack = createNativeStackNavigator<RetailerStackParamList>();

const TAB_ICONS: Record<keyof RetailerTabParamList, string> = {
  Home: 'home',
  Categories: 'apps',
  BuyAgain: 'replay',
  Orders: 'receipt-long',
  Profile: 'person',
};

const TAB_LABELS: Record<keyof RetailerTabParamList, string> = {
  Home: 'Home',
  Categories: 'Categories',
  BuyAgain: 'Buy again',
  Orders: 'Orders',
  Profile: 'Profile',
};

function RetailerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textGhost,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '800' },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingTop: 6,
          height: 76,
        },
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ color }) => (
          <Icon name={TAB_ICONS[route.name]} size={24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="BuyAgain" component={BuyAgainScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RetailerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RetailerTabs} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
    </Stack.Navigator>
  );
}
