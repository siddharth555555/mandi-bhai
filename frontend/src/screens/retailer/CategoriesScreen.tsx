import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius } from '../../theme';
import {
  listCategories,
  searchProducts,
  type Category,
  type Product,
} from '../../api/client';
import type { RetailerStackParamList, RetailerTabParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RetailerStackParamList>;
type Rt = RouteProp<RetailerTabParamList, 'Categories'>;

/**
 * Two-pane browse, matching the prototype: category rail down the left,
 * products for the selected category on the right.
 */
export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    listCategories()
      .then((cats) => {
        setCategories(cats);
        setActiveId((current) => current ?? route.params?.categoryId ?? cats[0]?.id ?? null);
      })
      .finally(() => setLoadingCats(false));
  }, [route.params?.categoryId]);

  // Honour a category passed in from the Home screen's rail.
  useEffect(() => {
    if (route.params?.categoryId) setActiveId(route.params.categoryId);
  }, [route.params?.categoryId]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingProducts(true);
    searchProducts({ categoryId: activeId, limit: 50 })
      .then((page) => {
        setProducts(page.items);
        setTotal(page.total);
      })
      .finally(() => setLoadingProducts(false));
  }, [activeId]);

  const active = categories.find((c) => c.id === activeId) ?? null;

  if (loadingCats) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Categories</Text>
      </View>

      <View style={styles.panes}>
        {/* ---------- left rail ---------- */}
        <ScrollView
          style={styles.rail}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {categories.map((c) => {
            const isActive = c.id === activeId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.railItem, isActive && styles.railItemActive]}
                onPress={() => setActiveId(c.id)}
              >
                {isActive ? (
                  <View
                    style={[
                      styles.railAccent,
                      { backgroundColor: c.iconColor ?? colors.primary },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.railIcon,
                    { backgroundColor: c.tint ?? colors.blueSoft },
                  ]}
                >
                  <Icon name={c.icon} size={24} color={c.iconColor ?? colors.blue} />
                </View>
                <Text
                  numberOfLines={2}
                  style={[styles.railLabel, isActive && styles.railLabelActive]}
                >
                  {c.nameEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ---------- right pane ---------- */}
        <ScrollView
          style={styles.pane}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        >
          {active ? (
            <View style={styles.paneHeader}>
              <View
                style={[
                  styles.paneIcon,
                  { backgroundColor: active.tint ?? colors.blueSoft },
                ]}
              >
                <Icon
                  name={active.icon}
                  size={23}
                  color={active.iconColor ?? colors.blue}
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.paneTitle}>{active.nameEn}</Text>
                <Text style={styles.paneSub}>
                  {active.nameHi} · {total} {total === 1 ? 'product' : 'products'}
                </Text>
              </View>
            </View>
          ) : null}

          {loadingProducts ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          ) : products.length === 0 ? (
            <EmptyState
              icon="search"
              title="No products found"
              body="Nothing listed in this category yet."
            />
          ) : (
            <View style={styles.grid}>
              {products.map((p) => (
                <View key={p.id} style={styles.gridCell}>
                  <ProductCard
                    product={p}
                    imageHeight={96}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  panes: { flex: 1, flexDirection: 'row' },
  rail: { flexGrow: 0, flexBasis: 84, backgroundColor: colors.rail },
  railItem: {
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  railItemActive: { backgroundColor: colors.bg },
  railAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  railIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: {
    marginTop: 5,
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.textMuted,
  },
  railLabelActive: { color: colors.text },
  pane: { flex: 1 },
  paneHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  paneIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paneTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  paneSub: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginTop: 10 },
  gridCell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
});
