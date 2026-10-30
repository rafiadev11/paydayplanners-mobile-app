Pod::Spec.new do |s|
  s.name = 'WatchPairing'
  s.version = '1.0.0'
  s.summary = 'Paired watch connection requests'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'Power My Fitness LLC'
  s.homepage = 'https://paydayplanners.com'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/rafiadev11/paydayplanners-mobile-app' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity', 'Security'
  s.source_files = '**/*.swift'
end
