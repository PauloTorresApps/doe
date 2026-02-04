import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { LoginScreen } from "../screens/LoginScreen";
import { DiaryViewerScreen } from "../screens/DiaryViewerScreen";
import { KeywordManagementScreen } from "../screens/KeywordManagementScreen";
import { TabNavigator } from "./TabNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return <LoadingIndicator message="Carregando..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DiaryViewer"
              component={DiaryViewerScreen}
              options={({ route }) => ({
                title: route.params.title,
                headerBackTitle: "Voltar",
              })}
            />
            <Stack.Screen
              name="Keywords"
              component={KeywordManagementScreen}
              options={{
                title: "Expressões",
                headerBackTitle: "Voltar",
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
