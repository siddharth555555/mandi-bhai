import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { colors, radius, shadow } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { updateWholesalerAddress } from '../../api/client';

export default function WholesalerProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut, refreshUser } = useAuth();
  const shopName = user?.profiles.wholesaler?.shopName ?? 'Your business';
  const address = user?.profiles.wholesaler?.address ?? null;

  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(address ?? '');
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setAddressInput(address ?? '');
    setEditingAddress(true);
  };

  const save = async () => {
    if (!token || !addressInput.trim()) return;
    setSaving(true);
    try {
      await updateWholesalerAddress(token, addressInput.trim());
      await refreshUser();
      setEditingAddress(false);
    } catch (e) {
      Alert.alert('Could not save address', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    {
      icon: 'location-on',
      label: 'Pickup address',
      sub: address ?? 'Add your pickup address for riders',
      onPress: openEditor,
    },
    { icon: 'verified', label: 'Business KYC', sub: 'Not verified' },
    { icon: 'language', label: 'Language', sub: 'English' },
    { icon: 'notifications', label: 'Notifications', sub: 'Order alerts on' },
    { icon: 'info-outline', label: 'Help & support', sub: null },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.avatar}>
          <Icon name="warehouse" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.shopName}>{shopName}</Text>
          <Text style={styles.role}>Wholesaler</Text>
          <Text style={styles.phone}>+91 {user?.phone}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          {rows.map((r, i) => (
            <TouchableOpacity
              key={r.label}
              style={[styles.row, i > 0 && styles.rowDivided]}
              disabled={!r.onPress}
              onPress={r.onPress}
            >
              <View style={styles.rowIcon}>
                <Icon name={r.icon} size={21} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.sub ? (
                  <Text numberOfLines={1} style={styles.rowSub}>
                    {r.sub}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={22} color="#C7C1D4" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editingAddress} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pickup address</Text>
            <TextInput
              style={styles.input}
              placeholder="Godown/shop no, street, mandi area"
              placeholderTextColor={colors.textGhost}
              value={addressInput}
              onChangeText={setAddressInput}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingAddress(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, !addressInput.trim() && styles.modalSaveDisabled]}
                disabled={saving || !addressInput.trim()}
                onPress={save}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
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
    paddingBottom: 24,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  role: { color: colors.onNavy, fontSize: 13, fontWeight: '700' },
  phone: { color: colors.onNavyFaint, fontSize: 12, fontWeight: '700', marginTop: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#F4EEE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontWeight: '800', fontSize: 14.5, color: colors.text },
  rowSub: { fontWeight: '700', fontSize: 12, color: colors.textFaint, marginTop: 1 },
  signOut: { marginTop: 20, alignItems: 'center', padding: 14 },
  signOutText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 20,
  },
  modalTitle: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 12 },
  input: {
    backgroundColor: colors.sunken,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 80,
    fontWeight: '600',
    fontSize: 13.5,
    color: colors.text,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontWeight: '800', fontSize: 14, color: colors.textMuted },
  modalSave: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
