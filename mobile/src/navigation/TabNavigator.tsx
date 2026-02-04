import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DiaryListScreen } from "../screens/DiaryListScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#1a73e8",
        tabBarInactiveTintColor: "#999",
        tabBarLabelStyle: { fontSize: 12 },
        headerTitleAlign: "center",
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DiaryListScreen}
        options={{
          title: "Diários",
          tabBarLabel: "Diários",
          tabBarAccessibilityLabel: "Aba Diários",
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          title: "Busca",
          tabBarLabel: "Busca",
          tabBarAccessibilityLabel: "Aba Busca",
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          tabBarAccessibilityLabel: "Aba Perfil",
        }}
      />
    </Tab.Navigator>
  );
}
