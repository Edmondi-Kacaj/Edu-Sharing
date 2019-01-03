package org.edu_sharing.metadataset.v2.tools;

import org.edu_sharing.metadataset.v2.MetadataReaderV2;
import org.edu_sharing.metadataset.v2.MetadataSetV2;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.AuthenticationToolAPI;
import org.edu_sharing.repository.server.tools.ApplicationInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.restservices.admin.v1.Application;

public class MetadataHelper {

	public static MetadataSetV2 getMetadataset(ApplicationInfo appId,String mdsSet) throws Exception{
		return MetadataReaderV2.getMetadataset(appId, mdsSet,getLocale());
	}

	private static String getLocale() {
		String locale="default";
		try{
			locale = new AuthenticationToolAPI().getCurrentLocale();
		}catch(Throwable t){}
		return locale;
	}
	public static String getTranslation(String key) throws Exception {
		return getTranslation(ApplicationInfoList.getHomeRepository(),key,null);
	}
	public static String getTranslation(ApplicationInfo appId,String key,String fallback) throws Exception {
		return MetadataReaderV2.getTranslation(getMetadataset(appId,CCConstants.metadatasetdefault_id).getI18n(),key,fallback,getLocale());
	}

}