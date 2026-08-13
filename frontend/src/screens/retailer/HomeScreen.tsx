import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import {
  listCategories,
  searchProducts,
  type Category,
  type Product,
} from '../../api/client';
import type { RetailerStackParamList } from '../../navigation/types';
import { useAuth } from '../../auth/AuthContext';

type Nav = NativeStackNavigationProp<RetailerStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      setError(null);
      const [cats, page] = await Promise.all([
        listCategories(),
        searchProducts({ q, limit: 12 }),
      ]);
      setCategories(cats);
      setProducts(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the catalogue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce so we're not firing a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      load(query);
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  const searching = query.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* ---------- navy header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View style={styles.locationRow}>
            <Icon name="location-on" size={22} color={colors.primary} />
            <View style={{ marginLeft: 4 }}>
              <Text style={styles.deliverLabel}>Deliver to</Text>
              <Text style={styles.locationName}>
                {user?.profiles.retailer?.shopName ?? 'Your shop'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Cart')}
            >
              <Icon name="shopping-cart" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Icon name="notifications" size={21} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, styles.langButton]}>
              <Icon name="language" size={17} color="#fff" />
              <Text style={styles.langText}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Icon name="search" size={21} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search atta, rice, oil…"
            placeholderTextColor={colors.textGhost}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {searching ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close" size={20} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!searching && (
          <>
            {/* ---------- delivery banner ---------- */}
            <View style={styles.banner}>
              <Icon name="local-shipping" size={22} color={colors.warn} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  Same-day delivery on orders before 2 PM
                </Text>
                <Text style={styles.bannerSub}>
                  Pay on delivery · Udhaar available
                </Text>
              </View>
            </View>

            {/* ---------- categories ---------- */}
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRail}
            >
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.catTile}
                  onPress={() =>
                    navigation.navigate('Tabs', {
                      screen: 'Categories',
                      params: { categoryId: c.id },
                    })
                  }
                >
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: c.tint ?? colors.blueSoft },
                    ]}
                  >
                    <Icon
                      name={c.icon}
                      size={26}
                      color={c.iconColor ?? colors.blue}
                    />
                  </View>
                  <Text numberOfLines={2} style={styles.catLabel}>
                    {c.nameEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ---------- products ---------- */}
        <Text style={styles.sectionTitle}>
          {searching ? `Results for “${query.trim()}”` : 'Fresh in the catalogue'}
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={colors.primary} />
        ) : error ? (
          <EmptyState
            icon="error-outline"
            title="Couldn't load the catalogue"
            body={error}
            actionLabel="Try again"
            onAction={() => {
              setLoading(true);
              load(query);
            }}
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon="search"
            title="No products found"
            body={
              searching
                ? 'Try a different spelling — Hindi and English both work.'
                : 'The catalogue is empty. Run the seed script to populate it.'
            }
          />
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <View key={p.id} style={styles.gridCell}>
                <ProductCard
                  product={p}
                  onPress={() =>
                    navigation.navigate('ProductDetail', { productId: p.id })
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  deliverLabel: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
  locationName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButton: { flexDirection: 'row', width: 'auto', paddingHorizontal: 12, gap: 4 },
  langText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  searchBar: {
    marginTop: 14,
    height: 52,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  scroll: { padding: 16, paddingBottom: 32 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warnSoft,
    borderRadius: radius.lg,
    padding: 14,
  },
  bannerTitle: { fontWeight: '800', fontSize: 13.5, color: colors.text },
  bannerSub: { marginTop: 2, fontWeight: '700', fontSize: 12, color: colors.warn },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  catRail: { gap: 12, paddingRight: 8 },
  catTile: { width: 68, alignItems: 'center' },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '50%', paddingHorizontal: 5, marginBottom: 12 },
});
