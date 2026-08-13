import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { colors, radius, shadow } from '../theme';
import { useAuth } from '../auth/AuthContext';
import {
  listMyDeliveries,
  markDelivered,
  markDeliveryFailed,
  markPickedUp,
  type DeliveryView,
} from '../api/client';

const STATUS_LABEL: Record<DeliveryView['status'], string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned to you',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  failed: 'Failed',
};

/** Single-screen home for the delivery_partner (rider) role — no self-signup, riders are seeded manually. */
export default function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useAuth();

  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setDeliveries(await listMyDeliveries(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your deliveries');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPickedUp = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await markPickedUp(token, id);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  const onDelivered = (delivery: DeliveryView) => {
    if (!token) return;
    const isCod = delivery.order?.paymentMethod === 'cod';
    const proceed = async (paymentCollected?: boolean) => {
      setBusyId(delivery.id);
      try {
        await markDelivered(token, delivery.id, paymentCollected);
        await load();
      } catch (e) {
        Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
      } finally {
        setBusyId(null);
      }
    };

    if (isCod) {
      Alert.alert('Mark as delivered', 'Did you collect cash for this order?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'No, unpaid', onPress: () => proceed(false) },
        { text: 'Yes, collected', onPress: () => proceed(true) },
      ]);
    } else {
      Alert.alert('Mark as delivered?', 'This order is on Udhaar — it will be added to the retailer\'s credit balance.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => proceed() },
      ]);
    }
  };

  const onFailed = (id: string) => {
    if (!token) return;
    Alert.alert('Mark delivery as failed?', 'Stock will be released back to the wholesaler.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark failed',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await markDeliveryFailed(token, id, 'Could not deliver');
            await load();
          } catch (e) {
            Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const active = deliveries.filter((d) => d.status === 'assigned' || d.status === 'picked_up');
  const past = deliveries.filter((d) => d.status === 'delivered' || d.status === 'failed');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>My deliveries</Text>
        <Text style={styles.sub}>+91 {user?.phone}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
          <EmptyState icon="error-outline" title="Couldn't load deliveries" body={error} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Active</Text>
            {active.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="local-shipping" size={22} color={colors.textFaint} />
                <Text style={styles.emptyText}>No deliveries assigned to you right now.</Text>
              </View>
            ) : (
              active.map((d) => (
                <View key={d.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderNumber}>{d.order?.orderNumber}</Text>
                      <Text style={styles.cardSub}>
                        {d.order?.wholesalerName ?? 'Wholesaler'} → {d.order?.retailerName ?? 'Retailer'}
                      </Text>
                      <Text style={styles.address}>{d.order?.deliveryAddress}</Text>
                    </View>
                    <View style={styles.statusChip}>
                      <Text style={styles.statusChipText}>{STATUS_LABEL[d.status]}</Text>
                    </View>
                  </View>

                  <Text style={styles.amount}>
                    ₹{d.order?.subtotal} · {d.order?.paymentMethod === 'cod' ? 'Cash on delivery' : 'Udhaar'}
                  </Text>

                  <View style={styles.actionRow}>
                    {d.status === 'assigned' ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={busyId === d.id}
                        onPress={() => onPickedUp(d.id)}
                      >
                        {busyId === d.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.primaryText}>Mark picked up</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={busyId === d.id}
                        onPress={() => onDelivered(d)}
                      >
                        {busyId === d.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.primaryText}>Mark delivered</Text>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.dangerButton}
                      disabled={busyId === d.id}
                      onPress={() => onFailed(d.id)}
                    >
                      <Text style={styles.dangerText}>Failed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {past.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>History</Text>
                {past.map((d) => (
                  <View key={d.id} style={styles.pastRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderNumber}>{d.order?.orderNumber}</Text>
                      <Text style={styles.cardSub}>{d.order?.retailerName ?? 'Retailer'}</Text>
                    </View>
                    <Text
                      style={[
                        styles.pastStatus,
                        { color: d.status === 'delivered' ? colors.greenDark : colors.primaryDark },
                      ]}
                    >
                      {STATUS_LABEL[d.status]}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 13, fontWeight: '700', marginTop: 2 },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.sunken,
    borderRadius: radius.lg,
    padding: 14,
  },
  emptyText: { flex: 1, fontWeight: '700', fontSize: 12.5, color: colors.textFaint },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderNumber: { fontWeight: '800', fontSize: 14, color: colors.text },
  cardSub: { fontWeight: '700', fontSize: 12, color: colors.textFaint, marginTop: 2 },
  address: { fontWeight: '600', fontSize: 11, color: colors.textGhost, marginTop: 4 },
  statusChip: {
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: { fontWeight: '800', fontSize: 10, color: '#B9791C' },
  amount: { marginTop: 10, fontWeight: '700', fontSize: 12.5, color: colors.textMuted },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryButton: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  dangerButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    ...shadow.card,
  },
  pastStatus: { fontWeight: '800', fontSize: 12 },
  signOut: { marginTop: 20, alignItems: 'center', padding: 14 },
  signOutText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
});
