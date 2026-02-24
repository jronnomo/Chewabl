import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import StaticColors from "@/constants/colors";
import { useColors } from "@/context/ThemeContext";

const Colors = StaticColors;

export default function NotFoundScreen() {
  const Colors = useColors();
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <Text style={styles.emoji}>🍽️</Text>
        <Text style={[styles.title, { color: Colors.text }]}>Page not found</Text>
        <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
          This screen doesn't exist.
        </Text>
        <Link href="/" style={[styles.link, { backgroundColor: Colors.primary }]}>
          <Text style={styles.linkText}>Go back home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  link: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#FFF",
  },
});
