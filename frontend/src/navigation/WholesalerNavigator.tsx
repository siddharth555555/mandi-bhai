import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { colors } from '../theme';
import type {
  WholesalerStackParamList,
  WholesalerTabParamList,
} from './types';
import InventoryScreen from '../screens/wholesaler/InventoryScreen';
import CatalogueScreen from '../screens/wholesaler/CatalogueScreen';
import WholesalerProfileScreen from '../screens/wholesaler/WholesalerProfileScreen';
import ListingFormScreen from '../screens/wholesaler/ListingFormScreen';
import WholesalerOrdersScreen from '../screens/wholesaler/WholesalerOrdersScreen';
import WholesalerOrderDetailScreen from '../screens/wholesaler/WholesalerOrderDetailScreen';

const Tab = createBottomTabNavigator<WholesalerTabParamList>();
const Stack = createNativeStackNavigator<WholesalerStackParamList>();

const TAB_ICONS: Record<keyof WholesalerTabParamList, string> = {
  Inventory: 'inventory-2',
  Catalogue: 'sell',
  Orders: 'receipt-long',
  WholesalerProfile: 'person',
};

const TAB_LABELS: Record<keyof WholesalerTabParamList, string> = {
  Inventory: 'Inventory',
  Catalogue: 'Catalogue',
  Orders: 'Orders',
  WholesalerProfile: 'Profile',
};

function WholesalerTabs() {
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
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen name="Catalogue" component={CatalogueScreen} />
      <Tab.Screen name="Orders" component={WholesalerOrdersScreen} />
      <Tab.Screen name="WholesalerProfile" component={WholesalerProfileScreen} />
    </Tab.Navigator>
  );
}

export default function WholesalerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={WholesalerTabs} />
      <Stack.Screen name="AddListing" component={ListingFormScreen} />
      <Stack.Screen name="EditListing" component={ListingFormScreen} />
      <Stack.Screen name="WholesalerOrderDetail" component={WholesalerOrderDetailScreen} />
    </Stack.Navigator>
  );
}
