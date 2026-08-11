import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { colors, radius, shadow } from '../../theme';
import {
  createListing,
  deleteListing,
  getMyInventory,
  updateListing,
  type Listing,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { WholesalerStackParamList } from '../../navigation/types';

type Props =
  | NativeStackScreenProps<WholesalerStackParamList, 'AddListing'>
  | NativeStackScreenProps<WholesalerStackParamList, 'EditListing'>;

/** Shared by both the add and edit routes — the only difference is whether
 *  we start from an existing listing. */
export default function ListingFormScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const isEdit = route.name === 'EditListing';
  const params = route.params as WholesalerStackParamList['AddListing'] &
    WholesalerStackParamList['EditListing'];

  const [existing, setExisting] = useState<Listing | null>(null);
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [moq, setMoq] = useState('1');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !token) return;
    getMyInventory(token)
      .then((inv) => {
        const found = inv.items.find((i) => i.id === params.listingId) ?? null;
        if (found) {
          setExisting(found);
          setPrice(String(found.pricePerUnit));
          setMrp(found.mrp != null ? String(found.mrp) : '');
          setStock(String(found.stockUnits));
          setMoq(String(found.moq));
        }
      })
      .finally(() => setLoading(false));
  }, [isEdit, token, params.listingId]);

  const productName = isEdit ? existing?.product?.name : params.productName;
  const packLabel = isEdit ? existing?.product?.packLabel : params.packLabel;

  const priceNum = Number(price);
  const stockNum = Number(stock);
  const moqNum = Number(moq);
  const mrpNum = mrp.trim() ? Number(mrp) : undefined;

  const valid =
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    Number.isFinite(stockNum) &&
    stockNum >= 0 &&
    Number.isFinite(moqNum) &&
    moqNum >= 1 &&
    (mrpNum === undefined || (Number.isFinite(mrpNum) && mrpNum >= priceNum));

  const save = async () => {
    if (!token || !valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateListing(token, params.listingId, {
          pricePerUnit: priceNum,
          mrp: mrpNum,
          stockUnits: stockNum,
          moq: moqNum,
        });
      } else {
        await createListing(token, {
          productId: params.productId,
          pricePerUnit: priceNum,
          mrp: mrpNum,
          stockUnits: stockNum,
          moq: moqNum,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const togglePaused = async () => {
    if (!token || !existing) return;
    const next = existing.isActive ? 'inactive' : 'active';
    const updated = await updateListing(token, existing.id, { status: next });
    setExisting(updated);
  };

  const confirmDelete = () => {
    if (!token || !existing) return;
    const doDelete = async () => {
      await deleteListing(token, existing.id);
      navigation.goBack();
    };
    // Alert isn't available on RN web, so fall back to deleting directly there.
    if (Alert?.alert) {
      Alert.alert('Stop stocking this?', 'The listing will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    } else {
      doDelete();
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit listing' : 'List this product'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.productCard}>
          <Text style={styles.productName}>{productName ?? 'Product'}</Text>
          <Text style={styles.productPack}>{packLabel ?? ''}</Text>
        </View>

        <Text style={styles.label}>Your price (₹ per pack)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          placeholderTextColor={colors.textGhost}
        />

        <Text style={styles.label}>MRP (₹, optional)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={mrp}
          onChangeText={setMrp}
          placeholder="Leave blank if not printed"
          placeholderTextColor={colors.textGhost}
        />
        {mrpNum !== undefined && mrpNum < priceNum ? (
          <Text style={styles.fieldError}>MRP can't be below your price.</Text>
        ) : null}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stock (units)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={stock}
              onChangeText={setStock}
              placeholder="0"
              placeholderTextColor={colors.textGhost}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Min order (MOQ)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={moq}
              onChangeText={setMoq}
              placeholder="1"
              placeholderTextColor={colors.textGhost}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveButton, !valid && styles.saveButtonDisabled]}
          disabled={!valid || saving}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEdit ? 'Save changes' : 'List it'}
            </Text>
          )}
        </TouchableOpacity>

        {isEdit && existing ? (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={togglePaused}>
              <Text style={styles.secondaryButtonText}>
                {existing.isActive ? 'Pause this listing' : 'Resume this listing'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={confirmDelete}>
              <Text style={styles.dangerButtonText}>Stop stocking this</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  productCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
    ...shadow.card,
  },
  productName: { fontWeight: '800', fontSize: 15, color: colors.text },
  productPack: { fontWeight: '700', fontSize: 12.5, color: colors.textFaint, marginTop: 2 },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontWeight: '800',
    fontSize: 13,
    color: '#4A4556',
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontWeight: '700',
    fontSize: 15,
    backgroundColor: '#fff',
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 12 },
  fieldError: { marginTop: 6, color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  error: { marginTop: 14, color: colors.primaryDark, fontWeight: '700' },
  saveButton: {
    marginTop: 26,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryButton: { marginTop: 14, alignItems: 'center', padding: 12 },
  secondaryButtonText: { color: colors.blue, fontWeight: '800', fontSize: 14 },
  dangerButton: { marginTop: 2, alignItems: 'center', padding: 12 },
  dangerButtonText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
});
