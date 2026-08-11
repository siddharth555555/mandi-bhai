import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { Packshot } from '../../components/Packshot';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import {
  getMyInventory,
  searchProducts,
  type Product,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { WholesalerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<WholesalerStackParamList>;

/**
 * Search-first flow: the wholesaler looks for the product in the master
 * catalogue and lists it instantly. Only when nothing matches do they request
 * a brand-new product, which is the case that actually needs moderation.
 */
export default function CatalogueScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [stockedIds, setStockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadStocked = useCallback(async () => {
    if (!token) return;
    const inv = await getMyInventory(token).catch(() => null);
    if (inv) {
      setStockedIds(
        new Set(inv.items.map((i) => i.product?.id).filter(Boolean) as string[]),
      );
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadStocked();
    }, [loadStocked]),
  );

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setLoading(true);
        searchProducts({ q: query, limit: 30 })
          .then((page) => setProducts(page.items))
          .finally(() => setLoading(false));
      },
      query ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Master catalogue</Text>
        <Text style={styles.sub}>Find a product and list what you stock</Text>

        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={colors.textGhost}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close" size={19} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : products.length === 0 ? (
          <EmptyState
            icon="search"
            title="No products found"
            body="Nothing in the master catalogue matches that. Requesting a brand-new product arrives with the moderation module."
          />
        ) : (
          products.map((p) => {
            const alreadyStocked = stockedIds.has(p.id);
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.thumb}>
                  <Packshot
                    brand={p.brand ?? p.name}
                    weight={p.pack.label}
                    seed={p.id}
                    brandFontSize={8.5}
                    compact
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={styles.name}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta}>
                    {p.pack.label}
                    {p.category ? ` · ${p.category.nameEn}` : ''}
                  </Text>
                  <Text style={styles.offers}>
                    {p.offers.sellerCount > 0
                      ? `${p.offers.sellerCount} selling · from ₹${p.offers.lowestPrice}`
                      : 'No sellers yet'}
                  </Text>
                </View>

                {alreadyStocked ? (
                  <View style={styles.stockedChip}>
                    <Icon name="check-circle" size={15} color={colors.greenDark} />
                    <Text style={styles.stockedText}>Listed</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() =>
                      navigation.navigate('AddListing', {
                        productId: p.id,
                        productName: p.name,
                        packLabel: p.pack.label,
                      })
                    }
                  >
                    <Text style={styles.addButtonText}>LIST</Text>
                  </TouchableOpacity>
                )}
              </View>
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
    paddingBottom: 16,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 23, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  searchBar: {
    marginTop: 14,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    ...shadow.card,
  },
  thumb: {
    width: 52,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    position: 'relative',
    overflow: 'hidden',
  },
  name: { fontWeight: '800', fontSize: 13.5, color: colors.text, lineHeight: 17 },
  meta: { fontWeight: '700', fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  offers: { fontWeight: '700', fontSize: 11, color: colors.green, marginTop: 2 },
  addButton: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.primary, fontWeight: '800', fontSize: 12.5 },
  stockedChip: { alignItems: 'center', gap: 2 },
  stockedText: { fontSize: 10, fontWeight: '800', color: colors.greenDark },
});
