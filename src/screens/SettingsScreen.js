import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAppTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { 
  Settings, 
  Moon, 
  Sun, 
  Languages, 
  LogOut, 
  User, 
  Globe,
  RefreshCw 
} from 'lucide-react-native';
import Button from '../components/Button';

const SettingsScreen = () => {
  const { t, currentLanguage, changeLanguage } = useAppTranslation();
  const { currentTheme, toggleTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { userCurrency, refreshData, userCountry } = useCurrency();

  const [refreshing, setRefreshing] = useState(false);

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    Alert.alert(t('success'), `Langue chang√©e en ${lang.toUpperCase()}`);
  };

  const handleRefreshData = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
    Alert.alert(t('success'), 'Donn√©es mises √† jour');
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      '√ätes-vous s√ªr de vouloir vous d√©connecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'D√©connexion', 
          style: 'destructive',
          onPress: signOut
        },
      ]
    );
  };

  const getBackgroundColor = () => 
    currentTheme === 'dark' ? '#1f2937' : '#f8fafc';

  const getCardColor = () =>
    currentTheme === 'dark' ? '#374151' : '#ffffff';

  const getTextColor = () =>
    currentTheme === 'dark' ? '#ffffff' : '#1f2937';

  const getSecondaryTextColor = () =>
    currentTheme === 'dark' ? '#d1d5db' : '#6b7280';

  const SettingItem = ({ icon: Icon, title, description, action, rightComponent }) => (
    <View style={[styles.settingItem, { backgroundColor: getCardColor() }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: currentTheme === 'dark' ? '#4b5563' : '#f3f4f6' }]}>
          <Icon size={20} color={getTextColor()} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: getTextColor() }]}>
            {title}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, { color: getSecondaryTextColor() }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightComponent}
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <View style={styles.content}>
        
        {/* En-t√™te */}
        <View style={styles.header}>
          <Settings size={32} color="#3b82f6" />
          <Text style={[styles.title, { color: getTextColor() }]}>
            {t('settings')}
          </Text>
        </View>

        {/* Section Profil */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
            Profil
          </Text>
          <SettingItem
            icon={User}
            title={user?.name || 'Utilisateur'}
            description={user?.email}
            rightComponent={
              <Text style={[styles.settingValue, { color: getSecondaryTextColor() }]}>
                Connect√©
              </Text>
            }
          />
        </View>

        {/* Section Apparence */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
            Apparence
          </Text>
          <SettingItem
            icon={currentTheme === 'dark' ? Moon : Sun}
            title={t('theme')}
            description={currentTheme === 'dark' ? t('dark_mode') : t('light_mode')}
            rightComponent={
              <Switch
                value={currentTheme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={currentTheme === 'dark' ? '#ffffff' : '#ffffff'}
              />
            }
          />
        </View>

        {/* Section Langue */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
            Langue
          </Text>
          <SettingItem
            icon={Languages}
            title={t('language')}
            description={`Langue actuelle: ${currentLanguage.toUpperCase()}`}
            rightComponent={
              <Text style={[styles.settingValue, { color: getSecondaryTextColor() }]}>
                {currentLanguage.toUpperCase()}
              </Text>
            }
          />
          
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                currentLanguage === 'fr' && styles.languageOptionSelected
              ]}
              onPress={() => handleLanguageChange('fr')}
            >
              <Text style={[
                styles.languageOptionText,
                currentLanguage === 'fr' && styles.languageOptionTextSelected
              ]}>
                Ì∑´Ì∑∑ Fran√ßais
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.languageOption,
                currentLanguage === 'ar' && styles.languageOptionSelected
              ]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text style={[
                styles.languageOptionText,
                currentLanguage === 'ar' && styles.languageOptionTextSelected
              ]}>
                Ì∑∏Ì∑¶ ÿßŸÑÿπÿ±ÿ®Ÿäÿ©
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.languageOption,
                currentLanguage === 'en' && styles.languageOptionSelected
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[
                styles.languageOptionText,
                currentLanguage === 'en' && styles.languageOptionTextSelected
              ]}>
                Ì∑∫Ì∑∏ English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Donn√©es */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
            Donn√©es
          </Text>
          <SettingItem
            icon={Globe}
            title="Localisation"
            description={userCountry ? `${userCountry.name}${userCountry.city ? `, ${userCountry.city}` : ''}` : 'Non d√©tect√©e'}
            rightComponent={
              <Text style={[styles.settingValue, { color: getSecondaryTextColor() }]}>
                {userCurrency}
              </Text>
            }
          />
          
          <SettingItem
            icon={RefreshCw}
            title="Actualiser les donn√©es"
            description="Prix des m√©taux et taux de change"
            rightComponent={
              <TouchableOpacity 
                onPress={handleRefreshData}
                disabled={refreshing}
                style={styles.refreshButton}
              >
                <RefreshCw 
                  size={20} 
                  color={refreshing ? '#9ca3af' : '#3b82f6'} 
                />
              </TouchableOpacity>
            }
          />
        </View>

        {/* Section Compte */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
            Compte
          </Text>
          <Button
            title={t('logout')}
            onPress={handleLogout}
            icon={LogOut}
            variant="outline"
            style={styles.logoutButton}
          />
        </View>

        {/* Information version */}
        <View style={[styles.footer, { backgroundColor: getCardColor() }]}>
          <Text style={[styles.footerText, { color: getSecondaryTextColor() }]}>
            Zakati & Hajj Assistant v1.0.0
          </Text>
          <Text style={[styles.footerText, { color: getSecondaryTextColor() }]}>
            D√©velopp√© avec ‚ù§Ô∏è pour la communaut√© musulmane
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  settingRight: {
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 8,
  },
  languageOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  languageOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  languageOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#dbeafe',
  },
  languageOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  languageOptionTextSelected: {
    color: '#3b82f6',
  },
  logoutButton: {
    width: '100%',
  },
  footer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default SettingsScreen;
