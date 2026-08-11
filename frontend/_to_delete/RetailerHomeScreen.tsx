import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function RetailerHomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Retailer Home</Text>
      <Text style={styles.subtitle}>
        Signed in as {user?.phone} · {user?.profiles.retailer?.shopName}
      </Text>
      <Text style={styles.placeholder}>Placeholder — build the shopping flow here.</Text>
      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF7EF', padding: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 8, color: '#6B6577', textAlign: 'center' },
  placeholder: { marginTop: 20, color: '#A49EAF' },
  signOut: { marginTop: 30, padding: 12 },
  signOutText: { color: '#E23B1E', fontWeight: '800' },
});
