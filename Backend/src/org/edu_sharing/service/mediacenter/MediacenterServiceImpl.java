package org.edu_sharing.service.mediacenter;

import java.io.InputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.alfresco.model.ContentModel;
import org.alfresco.repo.security.authentication.AuthenticationUtil;
import org.alfresco.repo.security.authentication.AuthenticationUtil.RunAsWork;
import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.cmr.repository.ChildAssociationRef;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.NodeService;
import org.alfresco.service.cmr.repository.StoreRef;
import org.alfresco.service.cmr.search.ResultSet;
import org.alfresco.service.cmr.search.SearchParameters;
import org.alfresco.service.cmr.search.SearchService;
import org.alfresco.service.cmr.security.AuthorityService;
import org.alfresco.service.cmr.security.AuthorityType;
import org.alfresco.service.cmr.security.PermissionService;
import org.alfresco.service.namespace.QName;
import org.apache.log4j.Logger;
import org.edu_sharing.alfresco.service.OrganisationService;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.service.authority.AuthorityServiceFactory;
import org.edu_sharing.service.util.CSVTool;
import org.springframework.context.ApplicationContext;

public class MediacenterServiceImpl implements MediacenterService{
	
	Logger logger = Logger.getLogger(MediacenterServiceImpl.class);
	
	ApplicationContext  applicationContext = AlfAppContextGate.getApplicationContext();
	ServiceRegistry serviceregistry = (ServiceRegistry)applicationContext.getBean(ServiceRegistry.SERVICE_REGISTRY);
	AuthorityService authorityService = serviceregistry.getAuthorityService();
	NodeService nodeService = serviceregistry.getNodeService();
	org.edu_sharing.alfresco.service.AuthorityService eduAuthorityService = (org.edu_sharing.alfresco.service.AuthorityService)applicationContext.getBean("eduAuthorityService");
	OrganisationService organisationService = (OrganisationService) applicationContext
			.getBean("eduOrganisationService");
	org.edu_sharing.service.authority.AuthorityService eduAuthorityService2 = AuthorityServiceFactory.getLocalService();
	SearchService searchService = serviceregistry.getSearchService();


	
	@Override
	public int importMediacenters(InputStream csv) {
		RunAsWork<Integer> runAs = new RunAsWork<Integer>() {
			@Override
			public Integer doWork() throws Exception {
				List<List<String>> records = new CSVTool().getRecords(csv, CSVTool.ENC_ISO);

				int counter = 0;
				for (List<String> record : records) {

					String mzId = record.get(0);
					String mz = record.get(1);
					String plz = record.get(2);
					String ort = record.get(3);

					try {
						
						String authorityName = CCConstants.MEDIA_CENTER_GROUP_PREFIX + mzId;
						logger.info("creating:" + authorityName);
						
						if(authorityService.authorityExists("GROUP_" + authorityName)) {
							logger.info("authority already exists:" + authorityName);
							NodeRef authorityNodeRef = authorityService.getAuthorityNodeRef("GROUP_" + authorityName);
							
							String alfAuthorityName = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CM_PROP_AUTHORITY_AUTHORITYNAME));
							String currentDisplayName = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CM_PROP_AUTHORITY_AUTHORITYDISPLAYNAME));
							String currentCity = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY));
							String currentPLZ = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CCM_PROP_ADDRESS_POSTALCODE));
							
							if(mz != null && !mz.equals(currentDisplayName)) {
								authorityService.setAuthorityDisplayName(alfAuthorityName, mz);
								String mcAdminGroup = getMediacenterAdminGroup(alfAuthorityName);
								if(mcAdminGroup != null) {
									authorityService.setAuthorityDisplayName(mcAdminGroup, mz + org.edu_sharing.alfresco.service.AuthorityService.ADMINISTRATORS_GROUP_DISPLAY_POSTFIX);
								}
							}
							
							if(ort != null && !ort.equals(currentCity)) {
								nodeService.setProperty(authorityNodeRef, QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY), currentCity);
							}
							
							if(plz != null && !plz.equals(currentPLZ)) {
								nodeService.setProperty(authorityNodeRef, QName.createQName(CCConstants.CCM_PROP_ADDRESS_POSTALCODE), plz);
							}
							continue;
						}
						
						String alfAuthorityName = authorityService.createAuthority(AuthorityType.GROUP, authorityName);
						authorityService.setAuthorityDisplayName(alfAuthorityName, mz);
						
						//admin group
						//authorityService.createGroupWithType(AuthorityService.ADMINISTRATORS_GROUP, profile.getDisplayName() + AuthorityService.ADMINISTRATORS_GROUP_DISPLAY_POSTFIX, group, AuthorityService.MEDIACENTER_ADMINISTRATORS_GROUP_TYPE);
						AuthorityServiceFactory.getLocalService().createGroupWithType(
								org.edu_sharing.alfresco.service.AuthorityService.MEDIACENTER_ADMINISTRATORS_GROUP, 
								mz + org.edu_sharing.alfresco.service.AuthorityService.ADMINISTRATORS_GROUP_DISPLAY_POSTFIX, 
								authorityName, 
								org.edu_sharing.alfresco.service.AuthorityService.MEDIACENTER_ADMINISTRATORS_GROUP_TYPE);
						
						NodeRef authorityNodeRef = authorityService.getAuthorityNodeRef(alfAuthorityName);
						
						Map<QName, Serializable> groupExtProps = new HashMap<QName, Serializable>();
						groupExtProps.put(QName.createQName(CCConstants.CCM_PROP_GROUPEXTENSION_GROUPTYPE), CCConstants.MEDIA_CENTER_GROUP_TYPE);
						nodeService.addAspect(authorityNodeRef, QName.createQName(CCConstants.CCM_ASPECT_GROUPEXTENSION), groupExtProps);
						
						Map<QName, Serializable> groupAddressProps = new HashMap<QName, Serializable>();
						groupAddressProps.put(QName.createQName(CCConstants.CCM_PROP_ADDRESS_POSTALCODE), plz);
						groupAddressProps.put(QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY), ort);
						nodeService.addAspect(authorityNodeRef, QName.createQName(CCConstants.CCM_ASPECT_ADDRESS), groupAddressProps);
						
						Map<QName, Serializable> groupMZProps = new HashMap<QName, Serializable>();
						groupMZProps.put(QName.createQName(CCConstants.CCM_PROP_MEDIACENTER_ID), mzId);
						groupMZProps.put(QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY), ort);
						nodeService.addAspect(authorityNodeRef, QName.createQName(CCConstants.CCM_ASPECT_MEDIACENTER), groupMZProps);
						
						counter++;
					} catch (Exception e) {
						logger.error("error in record: " + ((record == null || record.size() < 1)?null:record.get(0)), e);
						throw e;
					}
				}
				return counter;
			}
		};

		return AuthenticationUtil.runAs(runAs, ApplicationInfoList.getHomeRepository().getUsername());
	}

	@Override
	public int importOrganisations(InputStream csv) {
		RunAsWork<Integer> runAs = new RunAsWork<Integer>() {
			@Override
			public Integer doWork() throws Exception {
				List<List<String>> records = new CSVTool().getRecords(csv, CSVTool.ENC_UTF8);

				int counter = 0;
				for (List<String> record : records) {
					String schoolId = record.get(0);
					String schoolName = record.get(1);
					String plz = (record.size() > 2) ? record.get(2) : null;
					String city = (record.size() > 3) ? record.get(3) : null;

					try {
						if(schoolId == null || schoolId.trim().length() == 0) {
							logger.info("no schoolid provided:" + record);
							continue;
						}

						if(authorityService.authorityExists("GROUP_ORG_" + schoolId)) {
							logger.info("authority already exists:" + schoolId);
							NodeRef authorityNodeRef = authorityService.getAuthorityNodeRef("GROUP_ORG_" + schoolId);
							String alfAuthorityName = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CM_PROP_AUTHORITY_AUTHORITYNAME));
							String currentDisplayName = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CM_PROP_AUTHORITY_AUTHORITYDISPLAYNAME));
							String currentCity = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY));
							String currentPLZ = (String)nodeService.getProperty(authorityNodeRef,QName.createQName(CCConstants.CCM_PROP_ADDRESS_POSTALCODE));
							
							if(schoolName != null && !schoolName.equals(currentDisplayName)) {
								authorityService.setAuthorityDisplayName(alfAuthorityName, schoolName);
								String authorityNameOrgAdmin = organisationService.getOrganisationAdminGroup(alfAuthorityName);
								if(authorityNameOrgAdmin != null) {
									authorityService.setAuthorityDisplayName(authorityNameOrgAdmin, schoolName + org.edu_sharing.alfresco.service.AuthorityService.ADMINISTRATORS_GROUP_DISPLAY_POSTFIX);
								}
							}
							
							if(city != null && !city.equals(currentCity)) {
								nodeService.setProperty(authorityNodeRef, QName.createQName(CCConstants.CCM_PROP_ADDRESS_CITY), currentCity);
							}
							
							if(plz != null && !plz.equals(currentPLZ)) {
								nodeService.setProperty(authorityNodeRef, QName.createQName(CCConstants.CCM_PROP_ADDRESS_POSTALCODE), plz);
							}
							
							continue;
						}

						logger.info("creating: " + schoolId + " " + schoolName);
						String organisationName = organisationService.createOrganization(schoolId, schoolName);

						String authorityName = PermissionService.GROUP_PREFIX + organisationName;

						eduAuthorityService2.addAuthorityAspect(authorityName, CCConstants.CCM_ASPECT_ADDRESS);
						eduAuthorityService2.setAuthorityProperty(authorityName, CCConstants.CCM_PROP_ADDRESS_POSTALCODE,
								plz);
						eduAuthorityService2.setAuthorityProperty(authorityName, CCConstants.CCM_PROP_ADDRESS_CITY, city);


						counter++;
					} catch (Exception e) {
						logger.error("error in record: " + ((record == null || record.size() < 1)?null:record.get(0)), e);
						throw e;
					}

				}

				return counter;
			}
		};

		return AuthenticationUtil.runAs(runAs, ApplicationInfoList.getHomeRepository().getUsername());
	}

	@Override
	public int importOrgMcConnections(InputStream csv, boolean removeSchoolsFromMC) {
		RunAsWork<Integer> runAs = new RunAsWork<Integer>() {
			@Override
			public Integer doWork() throws Exception {

				List<List<String>> records = new CSVTool().getRecords(csv, CSVTool.ENC_UTF8);

				/**
				 * remove schools from mediacenter
				 */
				if(removeSchoolsFromMC) {
					
					Map<String,List<String>> map = listToUniqueMap(records);
					
					for(Map.Entry<String,List<String>> entry : map.entrySet()) {
						String mzId = entry.getKey();
						SearchParameters sp = getSearchParameterMZ(mzId);
						ResultSet rs = searchService.query(sp);
						if (rs == null || rs.length() < 1) {
							logger.error("no mediacenter found for " + mzId);
							continue;
						}
						
						NodeRef nodeRefAuthorityMediacenter = rs.getNodeRef(0);
						String authorityNameMZ = (String) nodeService.getProperty(nodeRefAuthorityMediacenter,
								ContentModel.PROP_AUTHORITY_NAME);
						Set<String> mzContains = authorityService.getContainedAuthorities(AuthorityType.GROUP, authorityNameMZ, true);
						
						for(String schoolAuthorityName : mzContains) {
							//"GROUP_ORG_" + schoolId
							String schoolId = schoolAuthorityName.replace("GROUP_ORG_", "");
							if(!entry.getValue().contains(schoolId)) {
								logger.info("removing school " + schoolId + " from " + mzId +" cause its not in imported list");
								authorityService.removeAuthority(authorityNameMZ, schoolAuthorityName);
							}
						}
					}
			
				}
				
				
				int counter = 0;
				for (List<String> record : records) {
					String mzId = record.get(0);
					String schoolId = record.get(1);

					SearchParameters sp = getSearchParameterMZ(mzId);
					ResultSet rs = searchService.query(sp);

					if (rs == null || rs.length() < 1) {
						logger.error("no mediacenter found for " + mzId);
						continue;
					}

					NodeRef nodeRefAuthorityMediacenter = rs.getNodeRef(0);

					String authorityNameSchool = "GROUP_ORG_" + schoolId;

					sp = new SearchParameters();
					sp.setQuery("@cm\\:authorityName:" + authorityNameSchool);
					sp.setMaxItems(1);
					sp.setLanguage(SearchService.LANGUAGE_LUCENE);
					sp.setSkipCount(0);
					sp.addStore(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE);
					rs = searchService.query(sp);
					if (rs == null || rs.length() < 1) {
						logger.error("no school found for " + schoolId + " " + authorityNameSchool);
						continue;
					}

					String authorityNameMZ = (String) nodeService.getProperty(nodeRefAuthorityMediacenter,
							ContentModel.PROP_AUTHORITY_NAME);
					
					
					Set<String> mzContains = authorityService.getContainedAuthorities(AuthorityType.GROUP,authorityNameMZ,true);
					
					if(!mzContains.contains(authorityNameSchool)) {
						logger.info("adding school" + authorityNameSchool + " to MZ " + authorityNameMZ );
						authorityService.addAuthority(authorityNameMZ, authorityNameSchool);
						counter++;
					}else {
						logger.info("mediacenter:" + authorityNameMZ + " already contains " + authorityNameSchool);
					}
					
				}
				return counter;
			}
		};

		return AuthenticationUtil.runAs(runAs, ApplicationInfoList.getHomeRepository().getUsername());
	}
	
	Map<String,List<String>> listToUniqueMap(List<List<String>> records){
		Map<String,List<String>> result = new HashMap<String,List<String>>();

		for (List<String> record : records) {
			if(!result.containsKey(record.get(0))) {
				List<String> list = new ArrayList<String>();
				list.add(record.get(1));
				result.put(record.get(0), list);
			}else {
				result.get(record.get(0)).add(record.get(1));
			}
		}
		
		return result;
	}
	
	private SearchParameters getSearchParameterMZ(String mzId) {
		SearchParameters sp = new SearchParameters();
		sp.setQuery("ASPECT:\"ccm:mediacenter\" AND @ccm\\:mediacenterId:\"" + mzId + "\"");
		sp.setMaxItems(1);
		sp.setLanguage(SearchService.LANGUAGE_LUCENE);
		sp.setSkipCount(0);
		sp.addStore(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE);
		return sp;
	}
	
	
	public String getMediacenterAdminGroup(String alfAuthorityName) {
		String authorityName = alfAuthorityName;

		NodeRef eduGroupNodeRef =authorityService.getAuthorityNodeRef(authorityName);
		List<ChildAssociationRef> childGroups = nodeService.getChildAssocs(eduGroupNodeRef);
		for(ChildAssociationRef childGroup : childGroups){
			String grouptype = (String)nodeService.getProperty(childGroup.getChildRef(), QName.createQName(CCConstants.CCM_PROP_GROUPEXTENSION_GROUPTYPE));
			if(org.edu_sharing.alfresco.service.AuthorityService.MEDIACENTER_ADMINISTRATORS_GROUP_TYPE.equals(grouptype)){
				return (String)nodeService.getProperty(childGroup.getChildRef(), QName.createQName(CCConstants.CM_PROP_AUTHORITY_AUTHORITYNAME));
			}
		}

		return null;
	}


}
