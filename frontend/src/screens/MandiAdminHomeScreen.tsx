import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { colors, radius, shadow } from '../theme';
import { useAuth } from '../auth/AuthContext';
import {
  assignDelivery,
  listDeliveryPartners,
  listUnassignedDeliveries,
  type DeliveryPartner,
  type DeliveryView,
} from '../api/client';

/**
 * Home for the Mandi Admin role. KYC/moderation queues still land here in
 * later phases of PLAN-products-kyc.md; the "unassigned deliveries" section
 * below is the live rider-assignment workflow from PLAN-order-delivery.md.
 */
export default function MandiAdminHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useAuth();

  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [d, p] = await Promise.all([listUnassignedDeliveries(token), listDeliveryPartners(token)]);
      setDeliveries(d);
      setPartners(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deliveries');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAssign = async (deliveryId: string, partnerId: string) => {
    if (!token) return;
    setBusyId(deliveryId);
    try {
      await assignDelivery(token, deliveryId, partnerId);
      setAssigningId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign rider');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Mandi Admin</Text>
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
        <Text style={styles.sectionTitle}>Unassigned deliveries</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : deliveries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="local-shipping" size={22} color={colors.textFaint} />
            <Text style={styles.emptyText}>No packed orders waiting for a rider right now.</Text>
          </View>
        ) : (
          deliveries.map((d) => (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardIcon}>
                <Icon name="local-shipping" size={22} color={colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{d.order?.orderNumber ?? 'Order'}</Text>
                <Text style={styles.cardSub}>
                  {d.order?.wholesalerName ?? 'Wholesaler'} → {d.order?.retailerName ?? 'Retailer'}
                </Text>
                <Text style={styles.cardAddress}>{d.order?.deliveryAddress}</Text>
              </View>
              <TouchableOpacity
                style={styles.assignButton}
                disabled={busyId === d.id}
                onPress={() => setAssigningId(d.id)}
              >
                {busyId === d.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.assignButtonText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Coming soon</Text>
        {[
          { icon: 'inventory-2', label: 'SKU moderation queue', sub: 'Approve, merge or reject submissions' },
          { icon: 'sell', label: 'Master catalogue', sub: 'Manage products and alternative names' },
          { icon: 'verified', label: 'KYC review', sub: 'Verify shops and wholesalers' },
        ].map((row) => (
          <View key={row.label} style={styles.card}>
            <View style={styles.cardIcon}>
              <Icon name={row.icon} size={22} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{row.label}</Text>
              <Text style={styles.cardSub}>{row.sub}</Text>
            </View>
            <View style={styles.soonChip}>
              <Text style={styles.soonText}>SOON</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!assigningId} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign a rider</Text>
            {partners.length === 0 ? (
              <Text style={styles.emptyText}>No riders available for this mandi.</Text>
            ) : (
              partners.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.partnerRow}
                  onPress={() => assigningId && onAssign(assigningId, p.id)}
                >
                  <Icon name="two-wheeler" size={20} color={colors.blue} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerName}>{p.name}</Text>
                    {p.vehicleInfo ? (
                      <Text style={styles.partnerVehicle}>{p.vehicleInfo}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setAssigningId(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  errorText: { fontWeight: '700', fontSize: 12.5, color: colors.primaryDark },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontWeight: '800', fontSize: 14.5, color: colors.text },
  cardSub: { fontWeight: '700', fontSize: 12, color: colors.textFaint, marginTop: 2 },
  cardAddress: { fontWeight: '600', fontSize: 11, color: colors.textGhost, marginTop: 2 },
  assignButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignButtonText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  soonChip: {
    backgroundColor: colors.sunken,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soonText: { fontWeight: '800', fontSize: 10, color: colors.textFaint },
  signOut: { marginTop: 20, alignItems: 'center', padding: 14 },
  signOutText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: 20,
  },
  modalTitle: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 12 },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  partnerName: { fontWeight: '800', fontSize: 14, color: colors.text },
  partnerVehicle: { fontWeight: '600', fontSize: 11.5, color: colors.textFaint, marginTop: 1 },
  modalCancel: { marginTop: 14, alignItems: 'center', padding: 12 },
  modalCancelText: { fontWeight: '800', fontSize: 14, color: colors.textMuted },
});
