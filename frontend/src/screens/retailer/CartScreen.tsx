import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
  getCart,
  removeCartItem,
  updateCartItem,
  type CartLineItem,
  type CartView,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { RetailerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RetailerStackParamList>;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();

  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setCart(await getCart(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your cart');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const adjustQuantity = async (item: CartLineItem, delta: number) => {
    if (!token) return;
    const next = item.quantity + delta;
    if (next <= 0) {
      await removeCartItem(token, item.id);
    } else {
      await updateCartItem(token, item.id, next);
    }
    load();
  };

  const remove = async (item: CartLineItem) => {
    if (!token) return;
    await removeCartItem(token, item.id);
    load();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your cart</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <EmptyState icon="error-outline" title="Couldn't load your cart" body={error} />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          icon="shopping-cart"
          title="Your cart is empty"
          body="Add products from the catalogue to start an order."
          actionLabel="Browse products"
          onAction={() => navigation.navigate('Tabs', { screen: 'Home' })}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            {cart.wholesalerGroups.map((group) => (
              <View key={group.wholesalerProfileId} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Icon name="warehouse" size={16} color={colors.blue} />
                  <Text style={styles.groupTitle}>{group.wholesalerName}</Text>
                </View>

                {group.items.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={styles.name}>
                        {item.product?.name ?? 'Product'}
                      </Text>
                      <Text style={styles.meta}>
                        {item.product?.packLabel} · ₹{item.pricePerUnit} each
                      </Text>
                      {!item.isValid ? (
                        <Text style={styles.warning}>
                          {item.unavailable
                            ? 'No longer available'
                            : item.belowMoq
                              ? `Minimum order is ${item.moq}`
                              : `Only ${item.stockUnits} in stock`}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepButton}
                        onPress={() => adjustQuantity(item, -1)}
                      >
                        <Icon name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={[styles.stepButton, styles.stepButtonAdd]}
                        onPress={() => adjustQuantity(item, 1)}
                      >
                        <Icon name="add" size={16} color={colors.blue} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.removeButton} onPress={() => remove(item)}>
                      <Icon name="delete-outline" size={18} color={colors.textFaint} />
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={styles.groupSubtotal}>Subtotal: ₹{group.subtotal}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{cart.subtotal}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, !cart.canCheckout && styles.checkoutDisabled]}
              disabled={!cart.canCheckout}
              onPress={() => navigation.navigate('Checkout')}
            >
              <Text style={styles.checkoutText}>
                {cart.canCheckout ? 'Proceed to checkout' : 'Fix items above to continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, paddingBottom: 24 },
  group: { marginBottom: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  groupTitle: { fontWeight: '800', fontSize: 13, color: colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
    ...shadow.card,
  },
  name: { fontWeight: '800', fontSize: 13.5, color: colors.text },
  meta: { fontWeight: '700', fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  warning: { marginTop: 4, fontWeight: '800', fontSize: 11, color: colors.primaryDark },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonAdd: { backgroundColor: colors.blueSoft },
  qty: { fontWeight: '800', fontSize: 14, minWidth: 22, textAlign: 'center' },
  removeButton: { padding: 4 },
  groupSubtotal: {
    textAlign: 'right',
    marginTop: 2,
    fontWeight: '800',
    fontSize: 12,
    color: colors.textFaint,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: { fontWeight: '700', fontSize: 14, color: colors.textMuted },
  totalValue: { fontWeight: '800', fontSize: 20, color: colors.text },
  checkoutButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutDisabled: { backgroundColor: colors.sunken },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
