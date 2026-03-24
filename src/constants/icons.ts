import { 
  Utensils, Coffee, Car, Bus, Gamepad2, Film, ShoppingBag, Smartphone, Stethoscope, 
  Home, Droplets, Zap, Book, Box, Wallet, Gift, Heart, Plane, Music, Camera, Wrench, Star, 
  Pizza, Briefcase, GraduationCap, HardDrive, UtensilsCrossed, Beer, Wine, Apple, Banana, 
  Cookie, Soup, Fish, Egg, Milk, Citrus, Grape, Carrot, Salad, GlassWater, ChefHat, 
  Croissant, TrainFront, Bike, Ship, Fuel, TramFront, Footprints, Construction, Navigation, 
  MapPin, Landmark, Rocket, Truck, Ambulance, Tv, Ticket, Mic2, Headphones, Monitor, 
  Clapperboard, Dices, PartyPopper, Guitar, Disc, Trophy, Cast, ShoppingCart, Store, 
  Package, Shirt, Watch, Glasses, Gem, Umbrella, ShoppingBasket, CreditCard, User, Users, 
  Smile, Frown, Meh, HandMetal, HelpingHand, Fingerprint, Scissors, Brush, Sparkles, 
  Flower, Baby, Tent, Activity, Pill, Hospital, Thermometer, Bandage, Syringe, Brain, 
  Eye, Ear, Shield, ShieldCheck, LifeBuoy, Bone, Bed, Lamp, Wifi, Key, Bath, Hammer, 
  Sofa, Tv2, AirVent, Laptop, Library, Calculator, Languages, Bookmark, Award, Microscope, 
  Telescope, Ruler, Compass, Globe, FlaskConical, Archive, FileText, Clipboard, Search, 
  Settings, Moon, Sun, Cloud, Wind, Flame, Snowflake, Link, Share2, MoreHorizontal, 
  Banknote, Coins, TrendingUp, PiggyBank, DollarSign, Euro, PoundSterling, JapaneseYen, 
  ArrowLeftRight, Repeat, RefreshCw, Replace, Shuffle, ArrowRightLeft, MoveRight, Send, 
  Mail, Inbox, Building, FastForward, Rewind, Building2, ReceiptText, HandCoins, Tag, Trash2, GripVertical,
  Edit2, Edit3
} from "lucide-react";

export const ICON_MAP: Record<string, any> = {
  Utensils, UtensilsCrossed, Coffee, Pizza, Beer, Wine, Apple, Banana, Cookie, Soup, Fish, Egg, Milk, Citrus, Grape, Carrot, Salad, GlassWater, ChefHat, Croissant,
  Car, Bus, Plane, TrainFront, Bike, Ship, Fuel, TramFront, Footprints, Construction, Navigation, MapPin, Landmark, Rocket, Truck, Ambulance,
  Gamepad2, Film, Music, Camera, Tv, Ticket, Mic2, Headphones, Monitor, Clapperboard, Dices, PartyPopper, Star, Guitar, Disc, Trophy, Cast,
  ShoppingBag, ShoppingCart, Gift, Tag, Store, Package, Shirt, Watch, Glasses, Gem, Umbrella, ShoppingBasket, Smartphone, CreditCard,
  User, Users, Heart, Smile, Frown, Meh, HandMetal, HelpingHand, Fingerprint, Scissors, Brush, Sparkles, Flower, Baby, Tent,
  Stethoscope, Activity, Pill, Hospital, Thermometer, Bandage, Syringe, Brain, Eye, Ear, Shield, ShieldCheck, LifeBuoy, Bone,
  Home, Droplets, Zap, Wrench, Bed, Lamp, Wifi, Trash2, Key, Bath, Hammer, Sofa, Tv2, AirVent,
  Book, GraduationCap, Laptop, Library, Calculator, Languages, Bookmark, Award, Microscope, Telescope, Ruler, Compass, Globe, FlaskConical,
  Box, Archive, FileText, Clipboard, Search, Settings, Moon, Sun, Cloud, Wind, Flame, Snowflake, Link, Share2, MoreHorizontal,
  Wallet, Banknote, Coins, TrendingUp, PiggyBank, Briefcase, DollarSign, Euro, PoundSterling, JapaneseYen,
  ArrowLeftRight, Repeat, RefreshCw, Replace, Shuffle, ArrowRightLeft, MoveRight, Send, Mail, Inbox, Building, Building2, ReceiptText, HandCoins, FastForward, Rewind,
  Edit2, Edit3
};

export const ICON_GROUPS = [
  { group: "帳戶", icons: ["Wallet", "CreditCard", "Banknote", "Coins", "Building", "Building2", "Landmark", "Briefcase", "PiggyBank", "Smartphone", "Shield", "Gem", "ArrowLeftRight", "ReceiptText", "HandCoins"] },
  { group: "飲食", icons: ["Utensils", "UtensilsCrossed", "Coffee", "Pizza", "Beer", "Wine", "Apple", "Banana", "Cookie", "Soup", "Fish", "Egg", "Milk", "Citrus", "Grape", "Carrot", "Salad", "GlassWater", "ChefHat", "Croissant"] },
  { group: "交通", icons: ["Car", "Bus", "Plane", "TrainFront", "Bike", "Ship", "Fuel", "TramFront", "Footprints", "Construction", "Navigation", "MapPin", "Landmark", "Rocket", "Truck", "Ambulance"] },
  { group: "娛樂", icons: ["Gamepad2", "Film", "Music", "Camera", "Tv", "Ticket", "Mic2", "Headphones", "Monitor", "Clapperboard", "Dices", "PartyPopper", "Star", "Guitar", "Disc", "Trophy", "Cast"] },
  { group: "購物", icons: ["ShoppingBag", "ShoppingCart", "Gift", "Tag", "Store", "Package", "Shirt", "Watch", "Glasses", "Gem", "Umbrella", "ShoppingBasket", "Smartphone", "CreditCard"] },
  { group: "個人", icons: ["User", "Users", "Heart", "Smile", "Frown", "Meh", "HandMetal", "HelpingHand", "Fingerprint", "Scissors", "Brush", "Sparkles", "Flower", "Baby", "Tent"] },
  { group: "醫療", icons: ["Stethoscope", "Activity", "Pill", "Hospital", "Thermometer", "Bandage", "Syringe", "Brain", "Eye", "Ear", "Shield", "ShieldCheck", "LifeBuoy", "Bone"] },
  { group: "家居", icons: ["Home", "Droplets", "Zap", "Wrench", "Bed", "Lamp", "Wifi", "Trash2", "Key", "Bath", "Hammer", "Sofa", "Tv2", "AirVent"] },
  { group: "學習", icons: ["Book", "GraduationCap", "Laptop", "Library", "Calculator", "Languages", "Bookmark", "Award", "Microscope", "Telescope", "Ruler", "Compass", "Globe", "FlaskConical"] },
  { group: "其他", icons: ["Box", "Archive", "FileText", "Clipboard", "Search", "Settings", "Moon", "Sun", "Cloud", "Wind", "Flame", "Snowflake", "Link", "Share2", "MoreHorizontal"] },
  { group: "收入", icons: ["Wallet", "Banknote", "Coins", "TrendingUp", "PiggyBank", "Briefcase", "DollarSign", "Euro", "PoundSterling", "JapaneseYen"] },
  { group: "轉帳", icons: ["ArrowLeftRight", "Repeat", "RefreshCw", "Replace", "Shuffle", "ArrowRightLeft", "MoveRight", "Send", "Mail", "Inbox", "Building", "FastForward", "Rewind"] },
];
