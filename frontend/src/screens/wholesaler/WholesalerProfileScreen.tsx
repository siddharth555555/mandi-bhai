import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { colors, radius, shadow } from '../../theme';
import { useAuth } from '../../auth/AuthContext';

export default function WholesalerProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const shopName = user?.profiles.wholesaler?.shopName ?? 'Your business';

  const rows = [
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
            <View key={r.label} style={[styles.row, i > 0 && styles.rowDivided]}>
              <View style={styles.rowIcon}>
                <Icon name={r.icon} size={21} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
              </View>
              <Icon name="chevron-right" size={22} color="#C7C1D4" />
            </View>
          ))}
        </View>

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
});
