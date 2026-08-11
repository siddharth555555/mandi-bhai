import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius } from '../../theme';

export default function BuyAgainScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Buy again</Text>
        <Text style={styles.sub}>Your regular items, one tap away</Text>
      </View>
      <ScrollView>
        <EmptyState
          icon="replay"
          title="Nothing to reorder yet"
          body="Place your first order to see it here."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 13, fontWeight: '700', marginTop: 2 },
});
