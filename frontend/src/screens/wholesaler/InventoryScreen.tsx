import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import {
  getMyInventory,
  updateListing,
  type InventoryResponse,
  type Listing,
  type StockStatus,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { WholesalerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<WholesalerStackParamList>;

const STOCK_STYLE: Record<StockStatus, { bg: string; fg: string; label: string }> = {
  in_stock: { bg: colors.greenSoft, fg: colors.greenDark, label: 'In stock' },
  low: { bg: colors.warnSoft, fg: '#B9791C', label: 'Low' },
  out: { bg: colors.primarySoft, fg: colors.primaryDark, label: 'Out' },
};

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();

  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Stock steppers feel bad if every tap waits on the network, so the number
   * updates locally straight away and the PATCH is debounced per listing.
   */
  const pending = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setData(await getMyInventory(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load inventory');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from "add listing" should show the new row.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const adjustStock = (listing: Listing, delta: number) => {
    if (!token || !data) return;
    const next = Math.max(0, listing.stockUnits + delta);

    setData({
      ...data,
      items: data.items.map((i) =>
        i.id === listing.id
          ? {
              ...i,
              stockUnits: next,
              stockStatus: next === 0 ? 'out' : next <= 10 ? 'low' : 'in_stock',
            }
          : i,
      ),
    });

    clearTimeout(pending.current[listing.id]);
    pending.current[listing.id] = setTimeout(() => {
      updateListing(token, listing.id, { stockUnits: next })
        .then(() => load())
        .catch(() => load());
    }, 700);
  };

  const summary = data?.summary;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Stock value</Text>
            <Text style={styles.statValue}>
              ₹{summary ? summary.stockValue.toLocaleString('en-IN') : '—'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Low / out</Text>
            <Text style={styles.statValue}>
              {summary ? `${summary.lowOrOutCount} SKUs` : '—'}
            </Text>
          </View>
        </View>
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
        <View style={styles.listHeader}>
          <Text style={styles.listCount}>
            {summary ? `${summary.listingCount} products listed` : ' '}
          </Text>
          <TouchableOpacity
            style={styles.addLink}
            onPress={() => navigation.navigate('Tabs', { screen: 'Catalogue' })}
          >
            <Icon name="add-circle" size={18} color={colors.primary} />
            <Text style={styles.addLinkText}>List new SKU</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : error ? (
          <EmptyState
            icon="error-outline"
            title="Couldn't load inventory"
            body={error}
            actionLabel="Try again"
            onAction={() => {
              setLoading(true);
              load();
            }}
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon="inventory-2"
            title="Nothing listed yet"
            body="Add products from the master catalogue to start selling."
            actionLabel="Browse catalogue"
            onAction={() => navigation.navigate('Tabs', { screen: 'Catalogue' })}
          />
        ) : (
          data.items.map((item) => {
            const chip = STOCK_STYLE[item.stockStatus];
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('EditListing', { listingId: item.id })
                }
                style={[styles.card, !item.isActive && styles.cardInactive]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.product?.name ?? 'Product'}
                  </Text>
                  <Text style={styles.meta}>
                    {item.product?.packLabel} · ₹{item.pricePerUnit} · MOQ {item.moq}
                  </Text>
                  <View style={styles.chipRow}>
                    <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.chipText, { color: chip.fg }]}>
                        {chip.label}
                      </Text>
                    </View>
                    {!item.isActive ? (
                      <View style={[styles.chip, { backgroundColor: colors.sunken }]}>
                        <Text style={[styles.chipText, { color: colors.textFaint }]}>
                          PAUSED
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustStock(item, -1)}
                  >
                    <Icon name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stockNumber}>{item.stockUnits}</Text>
                  <TouchableOpacity
                    style={[styles.stepButton, styles.stepButtonAdd]}
                    onPress={() => adjustStock(item, 1)}
                  >
                    <Icon name="add" size={18} color={colors.blue} />
                  </TouchableOpacity>
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
    paddingBottom: 18,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
  },
  statLabel: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
  statValue: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 2 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listCount: { fontWeight: '800', fontSize: 14, color: colors.textMuted },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addLinkText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
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
  cardInactive: { opacity: 0.6 },
  name: { fontWeight: '800', fontSize: 13.5, color: colors.text },
  meta: { fontWeight: '700', fontSize: 12, color: colors.textFaint, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  chipText: { fontSize: 10.5, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonAdd: { backgroundColor: colors.blueSoft },
  stockNumber: {
    fontWeight: '800',
    fontSize: 16,
    minWidth: 34,
    textAlign: 'center',
    color: colors.text,
  },
});
