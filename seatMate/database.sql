CREATE DATABASE IF NOT EXISTS seatmate_core;
USE seatmate_core;
CREATE TABLE users(id BIGINT PRIMARY KEY AUTO_INCREMENT,email VARCHAR(190) NOT NULL UNIQUE,name VARCHAR(100) NOT NULL,role ENUM('STUDENT','TEACHER') NOT NULL) ENGINE=InnoDB;
CREATE TABLE buses(id BIGINT PRIMARY KEY AUTO_INCREMENT,number VARCHAR(30) NOT NULL UNIQUE,destination VARCHAR(100) NOT NULL,stops VARCHAR(1000) NOT NULL,capacity INT NOT NULL CHECK(capacity>0),staff_only BOOLEAN NOT NULL DEFAULT FALSE) ENGINE=InnoDB;
CREATE TABLE schedules(id BIGINT PRIMARY KEY AUTO_INCREMENT,bus_id BIGINT NOT NULL,departure TIME NOT NULL,opens TIME NOT NULL,closes TIME NOT NULL,FOREIGN KEY(bus_id) REFERENCES buses(id),UNIQUE(bus_id,departure),CHECK(opens<closes AND closes<=departure)) ENGINE=InnoDB;
CREATE TABLE trips(id BIGINT PRIMARY KEY AUTO_INCREMENT,schedule_id BIGINT NOT NULL,travel_date DATE NOT NULL,FOREIGN KEY(schedule_id) REFERENCES schedules(id),UNIQUE(schedule_id,travel_date)) ENGINE=InnoDB;
CREATE TABLE bookings(id BIGINT PRIMARY KEY AUTO_INCREMENT,user_id BIGINT NOT NULL,trip_id BIGINT NOT NULL,travel_date DATE NOT NULL,departure TIME NOT NULL,seat_no INT NOT NULL CHECK(seat_no>0),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(trip_id) REFERENCES trips(id),UNIQUE(trip_id,seat_no),UNIQUE(user_id,travel_date,departure)) ENGINE=InnoDB;
INSERT INTO users(email,name,role) VALUES ('student@college.example','Demo Student','STUDENT'),('teacher@college.example','Demo Teacher','TEACHER');
INSERT INTO buses(number,destination,stops,capacity,staff_only) VALUES
('1C','Ennore','Aminjikarai, KMC, Central, Kaladipet market, Lift Gate, Ennore',40,FALSE),
('2C','Tondiarpet','Basin Bridge, Mint, Maharani, Tondiarpet Mani Cycle Shop, TH Road',40,FALSE),
('3','Choolai','Shenoy nagar Bus Stop, Kallarai- Road, Kellys - Signal, Muthumariamman kovil (Dovton Bridge), Saravana Stores - Pursaiwakkam, Choolai post office',40,FALSE),
('4','Chintadripet','Anna Arch, NSK Nagar, Pantaloon, Loyola College, Chintadripet',40,FALSE),
('5A','CMBT','Velappanchavadi, Vanagaram, Maduravoyal, Nerkundram, Koyambedu, CMBT, Thirunagar',40,FALSE),
('5B','Chintamani','Velappanchavadi, Vanagaram, Maduravoyal, koyambedu, Arumbakkam, Anna Arch, Chintamani',40,FALSE),
('6','New Avadi Road Water Tank','Anna nagar metro, Hot chips, Santhosh super market, Tower park metro, Blue star, Ayyapan kovil, Nalli silks, Kandasamy college, New avadi road water tank',40,FALSE),
('7','K4 Police station (Mohan Villa)','Golden flat, Velammal (Mugappair), TSK Nagar, Collector nagar, 18th main road, K4 Police Station, Mohan Villa',40,FALSE),
('8C','Waves','8 & 8C Combined',40,FALSE),
('9B','Mogappair East','7M Bus Stand, Ambedkar ground, Spartan School',40,FALSE),
('9A','Mogappair','9, 9A, 9B & 9C Combined',40,FALSE),
('10C','Ayanavaram','Britannia, Lucas, Villivakkam, ICF, Ayanavaram',40,FALSE),
('11C','Retteri','Telephone exchange, Pattaravakkam, Korattur, DRJ, Senthilnagar, Retteri',40,FALSE),
('11A','MKB Nagar','DRJ, Retteri, Madhavaram, Moolakadai, MKB',40,FALSE),
('12A','Moolakadai','Retteri, Venus Bus Stop, Perambur Rly Station, Lakshmi Amman Koil',40,FALSE),
('13','TVK Nagar','Retteri, Donbosco school, BPCL Bunk, TVK Bus Stand',40,FALSE),
('12C','Temple School','Padi, Britannia, Temple School',40,FALSE),
('14','Manali','Moolakadai, Madhavaram, Mathur, Manali',40,FALSE),
('15D','Ayappakkam (Selvi Mahal)','Velapanchavadi, Thiruverkadu, Ayappakkam Water Tank',40,FALSE),
('15F','Ayapakkam','Thirumullaivoyal, Ambattur OT, Dunlop, Ayapakkam',40,FALSE),
('15B','Kallikuppam','Amathurmedu, Thandrai, Pattabiram bus stand, Hindu College, Sekkadu, Pudur, Oragadam, Kallikuppam',40,FALSE),
('16E','Ambattur','Pattabiram (Gandhi Nagar), Thirumullaivoyal, Sarsvathinagar, Vaishnavinagar, Ambattur',40,FALSE),
('16A','Redhills Bus Stand','Thirumullaivoyal, Sarsvathinagar, Vaishnavinagar, Kallikupam, oragadam, Pudur, Redhills Bus Stand',40,FALSE),
('16B','Puzhal','Pattabiram, Ambattur, Oragadam, Pudur, Puzhal',40,FALSE),
('17C','Veppampattu','Aranvoyal, Ondikuppam, GRT, Veppampattu',40,FALSE),
('17F','Thiruvallur','Mevalur kuppam, Kattu koot Road, Mavalanagar, Vasanthabhavan',40,FALSE),
('17B','Thiruvallur','Mevalur kuppam, Post Office, SBI, Vasanthabhavan, Thiruvallur New Bus Stand',40,FALSE),
('17E','Thirunindravur','Thirumazhisai, Puthuchathiram, Kottabedu, Thirunindravur, Nemilichery Nanban Snacks',40,FALSE),
('18','Avadi (Checkpost)','Senneerkuppam, Jp estate, Avadi (Checkpost)',40,FALSE),
('18B','Avadi (Checkpost)','Senneerkuppam, Jp estate, Avadi (Checkpost)',40,FALSE),
('18D','Avadi (Veerapuram)','Nazarathpettai Bye Pass, Mittanemili, Kalainar Nagar, Ajay stadium, Vel Tech junction, Kollumedu GH',40,FALSE),
('19F','SP Kovil','Vandalur, Guduvanchery, Maraimalai nagar, SP Kovil',40,FALSE),
('0797','Kilambakkam Bus Stand','Vandalur, Kilambakkam',40,FALSE),
('19A','Perungalathur','Krishnanagar, Old Tambaram Kulam, Irumpuliyur, Perungalathur Bus stop',40,FALSE),
('19B','Varatharaja Theatre','Mudichur Road, Padmavathy Kalyanamandapam, Poondi bazaar, Varatharaja Theatre, Hasthinapuram',40,FALSE),
('20F','Tambaram','Mudichur Road, Padmavathy Kalyanamandapam, Tambaram',40,FALSE),
('20A','Sembakkam','Mudichur Road, Camp road, Sembakkam, Medavakkam X road, Nanmangalam',40,FALSE),
('20G','Kamatchi Hospital','Camp Road, Sembakkam, Medavakkam, Kamatchi Hospital',40,FALSE),
('20H','Madipakkam','Tambaram, Mepz, Chromepet, Madipakkam',40,FALSE),
('21A','Velachery','Thillaiganga Nagar subway, Ngo Colony Bus Stand, Velachery',40,FALSE),
('21','Sholinganallur','Regular route',40,FALSE),
('23','Kovilambakkam','Shanthi Petrol Bunk, Nanganallur, Independence park',40,FALSE),
('24','Nanganallur','Nagalkeni, Pallavaram, Pzhavanthangal sub way, JK Mahal, Moovarasampettai kulam',40,FALSE),
('25','VGP','Porur, Guindy, Anna university, Adyar, Thiruvanmiyur bus stand, Palavakkam, VGP',40,FALSE),
('26','Nandhanam','Porur, Guindy, Saidapet, Nandhanam',40,FALSE),
('27','Santhome','Porur, Guindy, Music academy, Luz, Billroth hospital, Kotturpuram, Santhome',40,FALSE),
('28','Valluvarkottam','Porur, Karambakkam, Lakshmi Nagar, Valasaravakkam, Avichi school, Vadapalani bus stand, Liberty',40,FALSE),
('29','Vadapalani','Kumanachavadi, Iyyappanthangal, Porur, Lakshmi Nagar, Valasaravakkam, Virugambakkam, Avichi School, Vadapalani',40,FALSE),
('30','Chinmaya Nagar','Lakshmi Nagar, Kesavarthini, Elango Nagar, Chinmaya Nagar Bus Stop, Natesan Nagar',40,FALSE),
('32','CIT Nagar','Iyyappanthangal, Porur, Ramapuram, Olympia, Ekkattuthangal, CIT Nagar',40,FALSE),
('33','MGR Nagar','Porur, Valasaravakkam, Virugambakkam, Alwarthiru nagar, Avichi, Nesapakkam, MGR Nagar',40,FALSE),
('34C','DLF','Kattupakkam, Iyyapanthangal, Porur, Saravana store, Mugaliwakkam',40,FALSE),
('37','Guindy','Kattupakkam, Iyyapanthangal, Porur, Guindy',40,FALSE),
('35','Pallavaram','Manikandan Nagar, Anakaputhur Bridge, Pozhichalur Church, Pallavaram',40,FALSE),
('35A','Kundrathur','Poonamallee Bye Pass, Mangadu, Kundrathur',40,FALSE),
('36C','Kovur','Porur, Baikadai, Madhanandapuram, Kovur',40,FALSE),
('37D','Karayanchavadi','RIT Bus Stop, Nazharathpettai, Kumunanchavadi, Karayanchavadi',40,FALSE),
('37C','Kumunanchavadi','RIT Bus Stop, Nazharathpettai, Poonamallee Depot, Kumunanchavadi',40,FALSE),
('38B','Kancheepuram Housing Board','Kancheepuram collectorate, Housing Board',40,FALSE),
('40D','Kancheepuram Bus Stand','Ponnerikarai, Kancheepuram Bus Stand',40,FALSE),
('40C','Meenakshi college','SPM Toll, SPM High school, Sunguvarchathiram Bus Stand, Santhavellore, Sathankulam, Rajakulam, Meenakshi college',40,FALSE),
('40A','Rangasamy kulam','SPM Bus stand, Vallakottai, Walajabad, Iyyampettai, Periyar Nagar, New police station, Rangasamy kulam',40,FALSE),
('42C','Arakkonam','Mappedu, Perambakkm, Thakkolam, Arakkonam',40,FALSE),
('42A','Arakkonam','Mappedu, Perambakkm, Thakkolam, Arakkonam',40,FALSE),
('41C','Vellore (Staff''s only)','Baluchetty, Ocheri, Walajapet Toll Gate, Walajapet Bus Stand, Arcot Bypass, Vellore Rountana',40,TRUE);

INSERT INTO schedules(bus_id,departure,opens,closes)
SELECT id,'15:15:00','14:45:00','15:05:00' FROM buses;
INSERT INTO schedules(bus_id,departure,opens,closes)
SELECT id,'17:00:00','16:45:00','17:00:00' FROM buses;
