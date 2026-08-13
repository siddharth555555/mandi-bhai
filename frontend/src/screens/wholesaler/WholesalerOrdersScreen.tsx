import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import { listIncomingOrders, type OrderSummary } from '../../api/client';
import { ORDER_STATUS_STYLE } from '../../orderStatus';
import { useAuth } from '../../auth/AuthContext';
import type { WholesalerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<WholesalerStackParamList>;

export default function WholesalerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setOrders(await listIncomingOrders(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load incoming orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.sub}>Incoming orders from retailers</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : error ? (
          <EmptyState
            icon="error-outline"
            title="Couldn't load orders"
            body={error}
            actionLabel="Try again"
            onAction={() => {
              setLoading(true);
              load();
            }}
          />
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt-long" title="No orders yet" body="Orders from retailers will show up here." />
        ) : (
          orders.map((o) => {
            const chip = ORDER_STATUS_STYLE[o.status];
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.card}
                onPress={() => navigation.navigate('WholesalerOrderDetail', { orderId: o.id })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.orderNumber}>{o.orderNumber}</Text>
                  <Text numberOfLines={1} style={styles.retailer}>
                    {o.retailerName ?? 'Retailer'} · {o.itemCount} item
                    {o.itemCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amount}>₹{o.subtotal}</Text>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 13, fontWeight: '700', marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  orderNumber: { fontWeight: '800', fontSize: 13.5, color: colors.text },
  retailer: { marginTop: 3, fontWeight: '700', fontSize: 11.5, color: colors.textFaint },
  amount: { fontWeight: '800', fontSize: 15, color: colors.text },
  chip: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 10.5, fontWeight: '800' },
});
