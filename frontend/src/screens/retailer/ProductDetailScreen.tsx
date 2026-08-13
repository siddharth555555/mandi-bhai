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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { Packshot } from '../../components/Packshot';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import { addCartItem, getProduct, type ProductDetail } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { RetailerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RetailerStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { productId } = route.params;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    getProduct(productId)
      .then(setProduct)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Could not load this product'),
      )
      .finally(() => setLoading(false));
  }, [productId]);

  const addToCart = async (listingId: string) => {
    if (!token || addingId) return;
    setAddingId(listingId);
    try {
      await addCartItem(token, listingId, 1);
      setAddedId(listingId);
      setTimeout(() => setAddedId((cur) => (cur === listingId ? null : cur)), 1500);
    } catch (e) {
      // surfaced inline via addedId staying null; keep it simple for v1
    } finally {
      setAddingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {product?.name ?? 'Product'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Cart')}>
          <Icon name="shopping-cart" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error || !product ? (
        <EmptyState
          icon="error-outline"
          title="Couldn't load this product"
          body={error ?? undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ---------- hero ---------- */}
          <View style={styles.hero}>
            <Packshot
              brand={product.brand ?? product.name}
              weight={product.pack.label}
              seed={product.id}
              brandFontSize={18}
            />
          </View>

          {product.category ? (
            <View style={styles.categoryChip}>
              <Icon name="category" size={14} color={colors.textMuted} />
              <Text style={styles.categoryChipText}>{product.category.nameEn}</Text>
            </View>
          ) : null}

          <Text style={styles.name}>{product.name}</Text>
          {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}

          <Text style={styles.packLine}>Pack size · {product.pack.label}</Text>
          <Text style={styles.baseLine}>
            Equivalent to {product.pack.baseValue} {product.pack.baseUnit}
          </Text>

          {/* ---------- alt names ---------- */}
          {product.aliases.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Also known as</Text>
              <View style={styles.aliasWrap}>
                {product.aliases.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.aliasChip,
                      a.locale === 'hi' && styles.aliasChipHi,
                    ]}
                  >
                    <Text
                      style={[
                        styles.aliasText,
                        a.locale === 'hi' && styles.aliasTextHi,
                      ]}
                    >
                      {a.alias}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.aliasHint}>
                Any of these will find this product in search.
              </Text>
            </>
          ) : null}

          {/* ---------- sellers ---------- */}
          <Text style={styles.sectionTitle}>
            {product.sellers.length > 0
              ? `${product.sellers.length} ${
                  product.sellers.length === 1 ? 'seller' : 'sellers'
                }`
              : 'Sellers'}
          </Text>

          {product.sellers.length === 0 ? (
            <View style={styles.sellerPlaceholder}>
              <Icon name="warehouse" size={22} color={colors.blue} />
              <Text style={styles.sellerPlaceholderText}>
                No wholesaler stocks this product yet.
              </Text>
            </View>
          ) : (
            product.sellers.map((s) => {
              const isOut = s.stockStatus === 'out';
              return (
                <View
                  key={s.listingId}
                  style={[
                    styles.sellerCard,
                    s.isBestPrice && styles.sellerCardBest,
                    isOut && styles.sellerCardOut,
                  ]}
                >
                  <View style={styles.sellerIcon}>
                    <Icon name="warehouse" size={22} color={colors.blue} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.sellerNameRow}>
                      <Text numberOfLines={1} style={styles.sellerName}>
                        {s.wholesalerName}
                      </Text>
                      {s.isBestPrice ? (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>BEST PRICE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.sellerMeta}>
                      {s.mandiName ?? '—'} · MOQ {s.moq}
                    </Text>
                    <View style={styles.stockRow}>
                      <View
                        style={[
                          styles.stockDot,
                          {
                            backgroundColor: isOut
                              ? colors.primaryDark
                              : s.stockStatus === 'low'
                                ? colors.warn
                                : colors.green,
                          },
                        ]}
                      />
                      <Text style={styles.stockText}>
                        {isOut
                          ? 'Out of stock'
                          : s.stockStatus === 'low'
                            ? `Only ${s.stockUnits} left`
                            : `${s.stockUnits} in stock`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.sellerPrice}>₹{s.pricePerUnit}</Text>
                    {s.mrp != null ? (
                      <Text style={styles.sellerMrp}>₹{s.mrp}</Text>
                    ) : null}
                    {s.savingsVsMrp != null && s.savingsVsMrp > 0 ? (
                      <Text style={styles.sellerSave}>save ₹{s.savingsVsMrp}</Text>
                    ) : null}
                    {!isOut ? (
                      <TouchableOpacity
                        style={[
                          styles.addButton,
                          addedId === s.listingId && styles.addButtonDone,
                        ]}
                        disabled={addingId === s.listingId}
                        onPress={() => addToCart(s.listingId)}
                      >
                        {addingId === s.listingId ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.addButtonText}>
                            {addedId === s.listingId ? 'Added' : 'Add to cart'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    height: 210,
    borderRadius: radius.xxl,
    backgroundColor: colors.sunken,
    position: 'relative',
    overflow: 'hidden',
  },
  categoryChip: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.sunken,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  categoryChipText: { fontWeight: '800', fontSize: 11, color: colors.textMuted },
  name: {
    marginTop: 10,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  brand: { marginTop: 2, fontSize: 14, fontWeight: '700', color: colors.textMuted },
  packLine: { marginTop: 12, fontSize: 15, fontWeight: '800', color: colors.text },
  baseLine: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.textFaint },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  aliasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aliasChip: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aliasChipHi: { backgroundColor: colors.blueSoft, borderColor: '#C7D5F7' },
  aliasText: { fontWeight: '800', fontSize: 13, color: colors.textMuted },
  aliasTextHi: { color: colors.blue },
  aliasHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGhost,
  },
  sellerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: '#C7D5F7',
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  sellerPlaceholderText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    color: '#223A80',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  sellerCardBest: { borderColor: colors.green },
  sellerCardOut: { opacity: 0.6 },
  sellerIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontWeight: '800', fontSize: 14, color: colors.text, flexShrink: 1 },
  bestBadge: {
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bestBadgeText: { fontSize: 9, fontWeight: '800', color: colors.greenDark },
  sellerMeta: {
    marginTop: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textFaint,
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  sellerPrice: { fontWeight: '800', fontSize: 17, color: colors.text },
  sellerMrp: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textGhost,
    textDecorationLine: 'line-through',
  },
  sellerSave: { fontSize: 10.5, fontWeight: '800', color: colors.greenDark },
  addButton: {
    marginTop: 8,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDone: { backgroundColor: colors.greenDark },
  addButtonText: { color: '#fff', fontWeight: '800', fontSize: 11.5 },
});
