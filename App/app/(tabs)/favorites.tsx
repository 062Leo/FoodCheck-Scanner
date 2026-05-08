import { View, Text, StyleSheet } from 'react-native';

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Favoriten – v2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#BDBDBD',
    fontSize: 16,
  },
});
